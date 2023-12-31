import internals from '../../shared/internals'
import { FiberNode } from './fiber'
import { Dispatch, Dispatcher } from 'react/src/currentDispatcher'
import {
	Update,
	UpdateQueue,
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	processUpdateQueue
} from './updateQueue'
import { Action } from 'shared/ReactType'
import { scheduleUpdateOnFiber } from './workLoop'
import { Lane, NoLane, requestUpdateLanes } from './fiberLanes'
import { Flags, PassiveEffect } from './fiberFlags'
import { HookHasEffect, Passive } from './hookEffectTags'
import currentBatchConfig from 'react/src/currentBatchConfig'

let currentlyRenderingFiber: FiberNode | null = null

let renderLane: Lane = NoLane

// 当前正在处理的hook
let workInProgressHook: Hook | null = null
let currentHook: Hook | null = null

const { currentDispatcher } = internals

interface Hook {
	// 保存hook对应的state
	memoizedState: any
	updateQueue: unknown
	// 与下一个Hook连接形成单向无环链表
	next: Hook | null
	baseState: any
	baseQueue: Update<any> | null
}

export interface Effect {
	tag: Flags
	create: EffectCallback | void
	destroy: EffectCallback | void
	deps: EffectDeps
	next: Effect | null
}

export interface FCUpdateQueue<State> extends UpdateQueue<State> {
	lastEffect: Effect | null
}

type EffectCallback = () => void
type EffectDeps = any[] | null
export function renderWithHooks(wip: FiberNode, lane: Lane) {
	// 赋值操作
	currentlyRenderingFiber = wip
	// 重置hooks链表
	wip.memoizedState = null
	// 重置effect链表
	wip.updateQueue = null

	renderLane = lane

	const current = wip.alternate

	if (current !== null) {
		// update
		currentDispatcher.current = HooksDispatcherOnUpdate
	} else {
		// mount
		currentDispatcher.current = HooksDispatcherOnMount
	}

	const Component = wip.type
	const props = wip.pendingProps
	const children = Component(props)
	// 重置
	currentlyRenderingFiber = null
	workInProgressHook = null
	currentHook = null
	renderLane = NoLane
	return children
}

const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState,
	useEffect: mountEffect,
	useTransition: mountTransition,
	useRef: mountRef
}
const HooksDispatcherOnUpdate: Dispatcher = {
	useState: updateState,
	useEffect: updateEffect,
	useTransition: updateTransition,
	useRef: updateRef
}
function mountState<State>(
	inititalState: (() => State) | State
): [State, Dispatch<State>] {
	// 找到当前useState对应的hook数据
	const hook = mountWorkInProgressHook()
	let memoizedState
	if (inititalState instanceof Function) {
		memoizedState = inititalState()
	} else {
		memoizedState = inititalState
	}

	const queue = createUpdateQueue<State>()
	hook.updateQueue = queue
	hook.memoizedState = memoizedState
	hook.baseState = memoizedState
	// @ts-ignore
	const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue)

	queue.dispatch = dispatch

	return [memoizedState, dispatch]
}

function mountTransition(): [boolean, (callback: () => void) => void] {
	const [isPending, setPending] = mountState(false)
	const hook = mountWorkInProgressHook()
	const start = startTransition.bind(null, setPending)
	hook.memoizedState = start
	return [isPending, start]
}

function startTransition(setPending: Dispatch<boolean>, callback: () => void) {
	setPending(true)
	const prevTransition = currentBatchConfig.transition
	currentBatchConfig.transition = 1
	callback()
	setPending(false)
	currentBatchConfig.transition = prevTransition
}
function updateTransition(): [boolean, (callback: () => void) => void] {
	const [isPending] = updateState()
	const hook = updateWorkInProgressHook()
	const start = hook.memoizedState
	return [isPending as boolean, start]
}

function mountEffect(create: EffectCallback | void, deps: EffectDeps | void) {
	const hook = mountWorkInProgressHook()
	const nextDeps = deps === undefined ? null : deps
	;(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect

	hook.memoizedState = pushEffect(
		Passive | HookHasEffect,
		create,
		undefined,
		nextDeps
	)
}

function updateEffect(create: EffectCallback | void, deps: EffectDeps | void) {
	const hook = updateWorkInProgressHook()
	const nextDeps = deps === undefined ? null : deps
	let destroy: EffectCallback | void

	if (currentHook !== null) {
		const prevEffect = currentHook.memoizedState as Effect
		destroy = prevEffect.destroy

		if (nextDeps !== null) {
			// 浅比较依赖
			const prevDeps = prevEffect.deps
			if (areHookInputsEqual(nextDeps, prevDeps)) {
				hook.memoizedState = pushEffect(Passive, create, destroy, nextDeps)
				return
			}
		}
		// 浅比较 不相等
		;(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect
		hook.memoizedState = pushEffect(
			Passive | HookHasEffect,
			create,
			destroy,
			nextDeps
		)
	}
}

function areHookInputsEqual(nextDeps: EffectDeps, prevDeps: EffectDeps) {
	if (prevDeps === null || nextDeps === null) {
		return false
	}
	for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
		if (Object.is(prevDeps[i], nextDeps[i])) {
			continue
		}
		return false
	}
	return true
}

function pushEffect(
	hookFlags: Flags,
	create: EffectCallback | void,
	destroy: EffectCallback | void,
	deps: EffectDeps
): Effect {
	const effect: Effect = {
		tag: hookFlags,
		create,
		destroy,
		deps,
		next: null
	}
	const fiber = currentlyRenderingFiber as FiberNode
	const updateQueue = fiber.updateQueue as FCUpdateQueue<any>
	if (updateQueue === null) {
		const updateQueue = createFCUpdateQueue()
		fiber.updateQueue = updateQueue
		effect.next = effect
		updateQueue.lastEffect = effect
	} else {
		// 插入effect
		const lastEffect = updateQueue.lastEffect
		if (lastEffect === null) {
			effect.next = effect
			updateQueue.lastEffect = effect
		} else {
			const firstEffect = lastEffect.next
			lastEffect.next = effect
			effect.next = firstEffect
			updateQueue.lastEffect = effect
		}
	}
	return effect
}

function createFCUpdateQueue<State>() {
	const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>
	updateQueue.lastEffect = null
	return updateQueue
}

function updateState<State>(): [State, Dispatch<State>] {
	// 找到当前useState对应的hook数据
	const hook = updateWorkInProgressHook()
	// 计算新的state
	const queue = hook.updateQueue as UpdateQueue<State>
	const baseState = hook.baseState
	const pending = queue.shared.pending
	const current = currentHook as Hook
	let baseQueue = current.baseQueue
	if (pending !== null) {
		if (baseQueue !== null) {
			// baseQueue b2 -> b0 -> b1 -> b2
			// pendingQueue p2 -> p0 -> p1 -> p2
			// b0
			const baseFirst = baseQueue.next
			// p0
			const pendingFirst = pending.next
			// b2 -> p0
			baseQueue.next = pendingFirst
			// p2 -> b0
			pending.next = baseFirst
			// p2 -> b0 -> b1 -> b2 -> p0 -> p1 -> p2
		}
		baseQueue = pending
		// 保存在current中
		current.baseQueue = pending
		queue.shared.pending = null
	}
	if (baseQueue !== null) {
		const {
			memoizedState,
			baseQueue: newBaseQueue,
			baseState: newBaseState
		} = processUpdateQueue(baseState, baseQueue, renderLane)
		hook.memoizedState = memoizedState
		hook.baseState = newBaseState
		hook.baseQueue = newBaseQueue
	}
	return [hook.memoizedState, queue.dispatch as Dispatch<State>]
}

function mountRef<T>(initialValue: T): { current: T } {
	const hook = mountWorkInProgressHook()
	const ref = { current: initialValue }
	hook.memoizedState = ref
	return ref
}

function updateRef<T>(initialValue: T): { current: T } {
	const hook = updateWorkInProgressHook()
	return hook.memoizedState
}

function updateWorkInProgressHook(): Hook {
	let nextCurrentHook: Hook | null = null
	if (currentHook === null) {
		// FC update时候的第一个hook
		const current = currentlyRenderingFiber?.alternate
		if (current !== null) {
			nextCurrentHook = current?.memoizedState
		} else {
			nextCurrentHook = null
		}
	} else {
		// FC update后续的hook
		nextCurrentHook = currentHook.next
	}
	if (nextCurrentHook === null) {
		throw new Error(
			`组件${currentlyRenderingFiber?.type}本次执行的hook比上次多`
		)
	}
	currentHook = nextCurrentHook as Hook
	const newHook: Hook = {
		memoizedState: currentHook.memoizedState,
		updateQueue: currentHook.updateQueue,
		next: null,
		baseQueue: currentHook.baseQueue,
		baseState: currentHook.baseState
	}

	if (workInProgressHook === null) {
		// mount 时候，第一个hook
		if (currentlyRenderingFiber === null) {
			throw new Error(
				'Hooks can only be called inside the body of a function component.'
			)
		} else {
			workInProgressHook = newHook
			currentlyRenderingFiber.memoizedState = workInProgressHook
		}
	} else {
		// mount时候后续的hook
		workInProgressHook.next = newHook
		workInProgressHook = newHook
	}
	return workInProgressHook
}

function dispatchSetState<State>(
	fiber: FiberNode,
	updateQueue: UpdateQueue<State>,
	action: Action<State>
) {
	const lane = requestUpdateLanes()

	const update = createUpdate(action, lane)

	enqueueUpdate(updateQueue, update)
	// 3. 请求调度, 进入reconciler运作流程中的`输入`环节.
	scheduleUpdateOnFiber(fiber, lane)
}

function mountWorkInProgressHook(): Hook {
	const hook: Hook = {
		memoizedState: null,
		updateQueue: null,
		next: null,
		baseQueue: null,
		baseState: null
	}

	if (workInProgressHook === null) {
		// mount 时候，第一个hook
		if (currentlyRenderingFiber === null) {
			throw new Error(
				'Hooks can only be called inside the body of a function component.'
			)
		} else {
			workInProgressHook = hook
			currentlyRenderingFiber.memoizedState = workInProgressHook
		}
	} else {
		// mount时候后续的hook
		workInProgressHook.next = hook
		workInProgressHook = hook
	}
	return workInProgressHook
}

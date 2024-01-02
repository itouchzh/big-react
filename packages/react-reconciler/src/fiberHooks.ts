import internals from '../../shared/internals'
import { FiberNode } from './fiber'
import { Dispatch, Dispatcher } from 'react/src/currentDispatcher'
import {
	UpdateQueue,
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	processUpdateQueue
} from './updateQueue'
import { Action } from 'shared/ReactType'
import { scheduleUpdateOnFiber } from './workLoop'

let currentlyRenderingFibger: FiberNode | null = null

// 当前正在处理的hook
let workInProgressHook: Hook | null = null
let currentHook: Hook | null = null

const { currentDispatcher } = internals

interface Hook {
	memoizedState: any
	updateQueue: unknown
	next: Hook | null
}
export function renderWithHooks(wip: FiberNode) {
	// 赋值操作
	currentlyRenderingFibger = wip
	wip.memoizedState = null

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
	currentlyRenderingFibger = null
	workInProgressHook = null
	currentHook = null
	return children
}

const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState
}

function mountState<State>(
	inititalState: () => State | State
): [State, Dispatch<State>] {
	// 找到当前useState对应的hook数据
	const hook = mountWorkInProgresHook()
	let memoizedState
	if (inititalState instanceof Function) {
		memoizedState = inititalState()
	} else {
		memoizedState = inititalState
	}

	const queue = createUpdateQueue<State>()
	hook.updateQueue = queue
	hook.memoizedState = memoizedState
	// @ts-ignore
	const dispatch = dispatchSetState.bind(null, currentlyRenderingFibger, queue)

	queue.dispatch = dispatch

	return [memoizedState, dispatch]
}

const HooksDispatcherOnUpdate: Dispatcher = {
	useState: updateState
}

function updateState<State>(): [State, Dispatch<State>] {
	// 找到当前useState对应的hook数据
	const hook = updateWorkInProgresHook()
	// 计算新的state
	const queue = hook.updateQueue as UpdateQueue<State>
	const pending = queue.shared.pending
	if (pending !== null) {
		const { memoizedState } = processUpdateQueue(hook.memoizedState, pending)
		hook.memoizedState = memoizedState
	}
	return [hook.memoizedState, queue.dispatch as Dispatch<State>]
}

function updateWorkInProgresHook(): Hook {
	let nextCurrentHook: Hook | null = null
	if (currentHook === null) {
		// FC update时候的第一个hook
		const current = currentlyRenderingFibger?.alternate
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
			`组件${currentlyRenderingFibger?.type}本次执行的hook比上次多`
		)
	}
	currentHook = nextCurrentHook as Hook
	const newHook: Hook = {
		memoizedState: currentHook.memoizedState,
		updateQueue: currentHook.updateQueue,
		next: null
	}

	if (workInProgressHook === null) {
		// mount 时候，第一个hook
		if (currentlyRenderingFibger === null) {
			throw new Error(
				'Hooks can only be called inside the body of a function component.'
			)
		} else {
			workInProgressHook = newHook
			currentlyRenderingFibger.memoizedState = workInProgressHook
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
	const update = createUpdate(action)

	enqueueUpdate(updateQueue, update)

	scheduleUpdateOnFiber(fiber)
}

function mountWorkInProgresHook(): Hook {
	const hook: Hook = {
		memoizedState: null,
		updateQueue: null,
		next: null
	}

	if (workInProgressHook === null) {
		// mount 时候，第一个hook
		if (currentlyRenderingFibger === null) {
			throw new Error(
				'Hooks can only be called inside the body of a function component.'
			)
		} else {
			workInProgressHook = hook
			currentlyRenderingFibger.memoizedState = workInProgressHook
		}
	} else {
		// mount时候后续的hook
		workInProgressHook.next = hook
		workInProgressHook = hook
	}
	return workInProgressHook
}

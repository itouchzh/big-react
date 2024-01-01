import internals from '../../shared/internals'
import { FiberNode } from './fiber'
import { Dispatch, Dispatcher } from 'react/src/currentDispatcher'
import {
	UpdateQueue,
	createUpdate,
	createUpdateQueue,
	enqueueUpdate
} from './updateQueue'
import { Action } from 'shared/ReactType'
import { scheduleUpdateOnFiber } from './workLoop'

let currentlyRenderingFibger: FiberNode | null = null

// 当前正在处理的hook
let workInProgressHook: Hook | null = null

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
	} else {
		// mount
		currentDispatcher.current = HooksDispatcherOnMount
	}

	const Component = wip.type
	const props = wip.pendingProps
	const children = Component(props)
	// 重置
	currentlyRenderingFibger = null
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

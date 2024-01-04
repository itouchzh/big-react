// 嵌套dom元素会dfs递归，直到遍历完所有元素，React Element 与 fiberNode进行比较

import { ReactElementType } from 'shared/ReactType'
import { FiberNode } from './fiber'
import { UpdateQueue, processUpdateQueue } from './updateQueue'
import {
	Fragment,
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTag'
import { mountChildFibers, reconcileChildFibers } from './childFibers'
import { renderWithHooks } from './fiberHooks'
import { Lane } from './fiberLanes'

// 递归的递 阶段
export const beginWork = (wip: FiberNode, renderLane:Lane) => {
	// 比较，返回子节点

	switch (wip.tag) {
		case HostRoot:
			return updateHostRoot(wip,renderLane)
		case HostComponent:
			return updateHostComponent(wip)
		case HostText:
			return null

		case FunctionComponent:
			return updateFunctionComponent(wip, renderLane)

		case Fragment:
			return updateFragment(wip)

		default:
			if (__DEV__) {
				console.warn('beginWork未实现', wip)
			}
			break
	}
	return null
}

function updateFragment(wip: FiberNode) {
	const nextChildren = wip.pendingProps

	reconileChildren(wip, nextChildren)
	return wip.child
}

function updateFunctionComponent(wip: FiberNode, renderLane:Lane) {
	const nextChildren = renderWithHooks(wip,renderLane)

	reconileChildren(wip, nextChildren)
	return wip.child
}

function updateHostRoot(wip: FiberNode, renderLane:Lane) {
	const baseState = wip.memoizedState
	const updateQueue = wip.updateQueue as UpdateQueue<Element>
	const pending = updateQueue.shared.pending
	updateQueue.shared.pending = null
	const { memoizedState } = processUpdateQueue(baseState, pending,renderLane)
	wip.memoizedState = memoizedState

	const nextChildren = wip.memoizedState
	reconileChildren(wip, nextChildren)
	return wip.child
}

function updateHostComponent(wip: FiberNode) {
	const nextProps = wip.pendingProps
	const nextChildren = nextProps.children
	reconileChildren(wip, nextChildren)
	return wip.child
}

function reconileChildren(wip: FiberNode, children?: ReactElementType) {
	const current = wip.alternate

	if (current !== null) {
		// update
		wip.child = reconcileChildFibers(wip, current?.child, children)
	} else {
		// mounted
		wip.child = mountChildFibers(wip, null, children)
	}
}

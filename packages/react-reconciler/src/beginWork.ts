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
import { Ref } from './fiberFlags'

// 递归的递 阶段
export const beginWork = (wip: FiberNode, renderLane: Lane) => {
	// 比较，返回子节点

	switch (wip.tag) {
		// fiber树的根节点是HostRootFiber节点
		case HostRoot:
			return updateHostRoot(wip, renderLane)
		// 普通 DOM 标签类型的节点(如div,span,p),会进入updateHostComponent:
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

function updateFunctionComponent(wip: FiberNode, renderLane: Lane) {
	const nextChildren = renderWithHooks(wip, renderLane)

	reconileChildren(wip, nextChildren)
	return wip.child
}

function updateHostRoot(wip: FiberNode, renderLane: Lane) {
	const baseState = wip.memoizedState
	// 1. 状态计算, 更新整合到 workInProgress.memoizedState中来
	const updateQueue = wip.updateQueue as UpdateQueue<Element>
	const pending = updateQueue.shared.pending
	updateQueue.shared.pending = null
	// 遍历updateQueue.shared.pending, 提取有足够优先级的update对象, 计算出最终的状态 workInProgress.memoizedState
	const { memoizedState } = processUpdateQueue(baseState, pending, renderLane)
	wip.memoizedState = memoizedState

	const nextChildren = wip.memoizedState
	// 3. 根据`ReactElement`对象, 调用`reconcileChildren`生成`Fiber`子节点(只生成`次级子节点`)
	reconileChildren(wip, nextChildren)
	return wip.child
}

function updateHostComponent(wip: FiberNode) {
	// 1. 状态计算, 由于HostComponent是无状态组件, 所以只需要收集 nextProps即可, 它没有 memoizedState
	const nextProps = wip.pendingProps
	const nextChildren = nextProps.children
	// 特殊操作需要设置fiber.flags
	markRef(wip.alternate, wip)
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

function markRef(current: FiberNode | null, workInProgressHook: FiberNode) {
	const ref = workInProgressHook?.ref
	// current === null ,对应的是mount阶段
	if (
		(current === null && ref !== null) ||
		(current !== null && current.ref !== ref)
	) {
		workInProgressHook.flags |= Ref
	}
}

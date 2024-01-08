// mounted 时候操作

import { Container } from 'hostConfig'
import { FiberNode, FiberRootNode } from './fiber'
import { HostRoot, WorkTag } from './workTag'
import {
	UpdateQueue,
	createUpdate,
	createUpdateQueue,
	enqueueUpdate
} from './updateQueue'
import { Key, Props, ReactElementType } from 'shared/ReactType'
import { scheduleUpdateOnFiber } from './workLoop'
import { requestUpdateLanes } from './fiberLanes'
import { unstable_ImmediatePriority, unstable_runWithPriority } from 'scheduler'

// create 内部
export function createContainer(container: Container) {
	// 1. 这里创建了`react`应用的首个`fiber`对象, 称为`HostRootFiber`
	const hostRootFiber = new FiberNode(HostRoot, {}, null)
	// 创建fiberRoot对象,
	const root = new FiberRootNode(container, hostRootFiber)
	hostRootFiber.updateQueue = createUpdateQueue()
	return root
}
/**
 * @description 创建Update来开启一次更新。
 * @param element
 * @param root FiberRootNode 顶级 root.current 为根节点
 * @returns
 * root.current = hostRootFiber
 * hostRootFiber.stateNode = root
 */
export const updateContainer = (
	element: ReactElementType | null,
	root: FiberRootNode
) => {
	unstable_runWithPriority(unstable_ImmediatePriority, () => {
		const hostRootFiber = root.current
		// 1. 创建一个优先级变量(车道模型)
		const lane = requestUpdateLanes()
		// 2. 根据车道优先级, 创建update对象, 并加入fiber.updateQueue.pending队列
		const update = createUpdate<ReactElementType | null>(element, lane)
		// 将生成的update加入updateQueue
		enqueueUpdate(
			hostRootFiber.updateQueue as UpdateQueue<ReactElementType | null>,
			update
		)
		// 调度更新
		scheduleUpdateOnFiber(hostRootFiber, lane)
	})

	return element
}

// render 内部
export function createFiberNode(
	tag: WorkTag,
	pendingProps: Props,
	key: Key
): FiberNode {
	return new FiberNode(tag, pendingProps, key)
}

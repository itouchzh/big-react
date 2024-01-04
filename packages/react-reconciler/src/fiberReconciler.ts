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

// create 内部
export function createContainer(container: Container) {
	const hostRootFiber = new FiberNode(HostRoot, {}, null)
	const root = new FiberRootNode(container, hostRootFiber)
	hostRootFiber.updateQueue = createUpdateQueue()
	return root
}

export const updateContainer = (
	element: ReactElementType | null,
	root: FiberRootNode
) => {
	const hostRootFiber = root.current
	const lane = requestUpdateLanes()
	const update = createUpdate<ReactElementType | null>(element, lane)
	enqueueUpdate(
		hostRootFiber.updateQueue as UpdateQueue<ReactElementType | null>,
		update
	)
	scheduleUpdateOnFiber(hostRootFiber,lane)
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

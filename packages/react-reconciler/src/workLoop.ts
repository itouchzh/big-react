import { scheduleMicroTask } from 'hostConfig'
import { beginWork } from './beginWork'
import {
	commitHookEffetListCreate,
	commitHookEffetListDestroy,
	commitHookEffetListUnmount,
	commitMutationEffects
} from './commitWork'
import { completeWork } from './completeWork'
import {
	FiberNode,
	FiberRootNode,
	PendingPassiveEffects,
	createWorkInProgress
} from './fiber'
import { MutationMask, NoFlags, PassiveMask } from './fiberFlags'
import {
	Lane,
	NoLane,
	SyncLane,
	getHighestPriorityLane,
	markRootFinished,
	mergeLanes
} from './fiberLanes'
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue'
import { HostRoot } from './workTag'

import {
	unstable_scheduleCallback as scheduleCallback,
	unstable_NormalPriority as NormalPriority
} from 'scheduler'
import { HookHasEffect, Passive } from './hookEffectTags'

// 正在工作的fiberNode
let workInProgress: FiberNode | null = null

let wipRootRenderLane: Lane = NoLane

let rootDoesHasPassiveEffects: boolean = false

//  初始化
function prepareFreshStack(root: FiberRootNode, lane: Lane) {
	workInProgress = createWorkInProgress(root.current, {})
	wipRootRenderLane = lane
}

// 连接container与renderRoot,在fiber中调度update
export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
	// 调度
	const root = markUpdateFromFiberToRoot(fiber)
	markRootUpdated(root, lane)
	ensureRootIsScheduled(root)
}
// 调度阶段入口
function ensureRootIsScheduled(root: FiberRootNode) {
	const updateLane = getHighestPriorityLane(root.pendingLanes)
	if (updateLane === NoLane) {
		return
	}
	if (updateLane === SyncLane) {
		// 同步优先级，微任务调度
		if (__DEV__) {
			console.log('在微任务中调度，优先级', updateLane)
		}
		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane))
		scheduleMicroTask(flushSyncCallbacks)
	} else {
		// 其他优先级，宏任务调度
	}
}
function markRootUpdated(root: FiberRootNode, lane: Lane) {
	root.pendingLanes = mergeLanes(root.pendingLanes, lane)
}

function markUpdateFromFiberToRoot(fiber: FiberNode) {
	let node = fiber
	let parent = node.return
	while (parent !== null) {
		node = parent
		parent = node.return
	}
	if (node.tag === HostRoot) {
		return node.stateNode
	}

	return null
}

function performSyncWorkOnRoot(root: FiberRootNode, lane: Lane) {
	const nextLane = getHighestPriorityLane(root.pendingLanes)
	if (nextLane !== SyncLane) {
		ensureRootIsScheduled(root)
		return
	}

	// 初始化
	prepareFreshStack(root, lane)
	// 递归
	do {
		try {
			workLoop()
			break
		} catch (e) {
			if (__DEV__) {
				console.warn('workLoop发生错误', e)
			}
			workInProgress = null
		}
	} while (true)
	//
	const finishedWork = root.current.alternate
	root.finishedWork = finishedWork
	root.finishedLane = lane

	wipRootRenderLane = NoLane
	// wip fiberNode 树中的flags
	commitRoot(root)
}
function commitRoot(root: FiberRootNode) {
	const finishedWork = root.finishedWork

	if (finishedWork === null) {
		return
	}

	if (__DEV__) {
		console.log('commitRoot 开始', finishedWork)
	}

	const lane = root.finishedLane

	if (lane === NoLane && __DEV__) {
		console.warn('commit 阶段不应该是NoLane')
	}
	// 重置
	root.finishedWork = null
	root.finishedLane = NoLane
	markRootFinished(root, lane)

	if (
		(finishedWork.flags & PassiveMask) !== NoFlags ||
		(finishedWork.subtreeFlags & PassiveMask) !== NoFlags
	) {
		if (!rootDoesHasPassiveEffects) {
			rootDoesHasPassiveEffects = true
			// 调度副作用
			scheduleCallback(NormalPriority, () => {
				// 执行副作用
				flushPassiveEffects(root.pendingPassiveEffects)

				return
			})
		}
	}
	const subtreeHasEffect =
		(finishedWork.subtreeFlags & MutationMask) !== NoFlags

	const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags

	if (subtreeHasEffect || rootHasEffect) {
		// beforeMutation
		// mutation placement
		commitMutationEffects(finishedWork, root)
		root.current = finishedWork
		// layout
	} else {
		root.current = finishedWork
	}

	rootDoesHasPassiveEffects = false
	ensureRootIsScheduled(root)
}

function flushPassiveEffects(pendingPassiveEffects: PendingPassiveEffects) {
	// 卸载
	pendingPassiveEffects.unmount.forEach((effect) => {
		commitHookEffetListUnmount(Passive, effect)
	})
	pendingPassiveEffects.unmount = []

	pendingPassiveEffects.update.forEach((effect) => {
		commitHookEffetListDestroy(Passive | HookHasEffect, effect)
	})

	pendingPassiveEffects.update.forEach((effect) => {
		commitHookEffetListCreate(Passive | HookHasEffect, effect)
	})
	pendingPassiveEffects.update = []
	flushSyncCallbacks()
}

function workLoop() {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress)
	}
}

function performUnitOfWork(fiber: FiberNode) {
	// next 可能是子fiberNode，也可能是null，如果是子fiberNode，则继续递归
	const next = beginWork(fiber, wipRootRenderLane)
	// 开始工作完，那么memoizedProps就是pendingProps
	fiber.memoizedProps = fiber.pendingProps

	if (next === null) {
		// 没有子fiberNode，那么就完成工作,执行归操作
		completeUnitOfWork(fiber)
	} else {
		workInProgress = next
	}
}

function completeUnitOfWork(fiber: FiberNode) {
	let node: FiberNode | null = fiber

	do {
		completeWork(node)
		// 没有子节点，就遍历兄弟节点
		const sibling = node.sibling
		if (sibling !== null) {
			workInProgress = sibling
			return
		}
		// 继续往上递归父级节点
		node = node.return
		workInProgress = node
	} while (node !== null)
}

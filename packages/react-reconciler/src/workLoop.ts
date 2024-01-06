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
	lanesToSchedulePriority,
	markRootFinished,
	mergeLanes
} from './fiberLanes'
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue'
import { HostRoot } from './workTag'

import {
	unstable_scheduleCallback as scheduleCallback,
	unstable_NormalPriority as NormalPriority,
	unstable_shouldYield,
	unstable_cancelCallback
} from 'scheduler'
import { HookHasEffect, Passive } from './hookEffectTags'

// 正在工作的fiberNode
let workInProgress: FiberNode | null = null

let wipRootRenderLane: Lane = NoLane

let rootDoesHasPassiveEffects: boolean = false

// type RootExitStatus = number
const RootInComplete = 1
const RootCompleted = 2
// TODO 执行过程中报错了

//  初始化
function prepareFreshStack(root: FiberRootNode, lane: Lane) {
	root.finishedLane = NoLane
	root.finishedWork = null
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
	const existingCallback = root.callbackNode
	if (updateLane === NoLane) {
		if (existingCallback !== null) {
			unstable_cancelCallback(existingCallback)
		}
		root.callbackNode = null
		root.callbackPriority = NoLane
		return
	}
	const curPriority = updateLane
	const prevPriority = root.callbackPriority

	if (curPriority === prevPriority) {
		return
	}

	if (existingCallback !== null) {
		unstable_cancelCallback(existingCallback)
	}
	let newCallbackNode = null
	if (updateLane === SyncLane) {
		// 同步优先级，微任务调度
		if (__DEV__) {
			console.log('在微任务中调度，优先级', updateLane)
		}
		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root))
		scheduleMicroTask(flushSyncCallbacks)
	} else {
		if (__DEV__) {
			console.log('在微任务中调度，优先级', updateLane)
		}
		// 其他优先级 用宏任务调度
		const schedulerPriority = lanesToSchedulePriority(updateLane)

		newCallbackNode = scheduleCallback(
			schedulerPriority,
			// @ts-ignore
			performConcurrentWorkOnRoot.bind(null, root)
		)
	}
	root.callbackNode = newCallbackNode
	root.callbackPriority = curPriority
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

function performSyncWorkOnRoot(root: FiberRootNode) {
	const nextLane = getHighestPriorityLane(root.pendingLanes)

	if (nextLane !== SyncLane) {
		// 其他比SyncLane低的优先级
		// NoLane
		ensureRootIsScheduled(root)
		return
	}

	const exitStatus = renderRoot(root, nextLane, false)

	if (exitStatus === RootCompleted) {
		const finishedWork = root.current.alternate
		root.finishedWork = finishedWork
		root.finishedLane = nextLane
		wipRootRenderLane = NoLane

		// wip fiberNode树 树中的flags
		commitRoot(root)
	} else if (__DEV__) {
		console.error('还未实现的同步更新结束状态')
	}
}

function performConcurrentWorkOnRoot(
	root: FiberRootNode,
	didTimeout: boolean
): any {
	// 保证useEffect回调执行
	const curCallback = root.callbackNode
	const didFlushPassiveEffect = flushPassiveEffects(root.pendingPassiveEffects)
	if (didFlushPassiveEffect) {
		if (root.callbackNode !== curCallback) {
			return null
		}
	}

	const lane = getHighestPriorityLane(root.pendingLanes)
	const curCallbackNode = root.callbackNode
	if (lane === NoLane) {
		return null
	}
	const needSync = lane === SyncLane || didTimeout
	// render阶段
	const exitStatus = renderRoot(root, lane, !needSync)

	ensureRootIsScheduled(root)

	if (exitStatus === RootInComplete) {
		// 中断
		if (root.callbackNode !== curCallbackNode) {
			return null
		}
		return performConcurrentWorkOnRoot.bind(null, root)
	}
	if (exitStatus === RootCompleted) {
		const finishedWork = root.current.alternate
		root.finishedWork = finishedWork
		root.finishedLane = lane
		wipRootRenderLane = NoLane
		commitRoot(root)
	} else if (__DEV__) {
		console.error('还未实现的并发更新结束状态')
	}
}

function renderRoot(root: FiberRootNode, lane: Lane, shouldTimeSlice: boolean) {
	if (__DEV__) {
		console.log(`开始${shouldTimeSlice ? '并发' : '同步'}更新`, root)
	}
	if (wipRootRenderLane !== lane) {
		// 初始化
		prepareFreshStack(root, lane)
	}

	// 递归
	do {
		try {
			shouldTimeSlice ? workLoopConcurrent() : workLoopSync()
			break
		} catch (e) {
			if (__DEV__) {
				console.warn('workLoop发生错误', e)
			}
			workInProgress = null
		}
	} while (true)

	// 中断执行
	if (shouldTimeSlice && workInProgress !== null) {
		return RootInComplete
	}
	// render阶段执行完
	if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
		console.error(`render阶段结束时wip不应该不是null`)
	}
	// TODO 报错
	return RootCompleted
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
	let didFlushPassiveEffect = false
	// 卸载
	pendingPassiveEffects.unmount.forEach((effect) => {
		didFlushPassiveEffect = true
		commitHookEffetListUnmount(Passive, effect)
	})
	pendingPassiveEffects.unmount = []

	pendingPassiveEffects.update.forEach((effect) => {
		didFlushPassiveEffect = true
		commitHookEffetListDestroy(Passive | HookHasEffect, effect)
	})

	pendingPassiveEffects.update.forEach((effect) => {
		didFlushPassiveEffect = true
		commitHookEffetListCreate(Passive | HookHasEffect, effect)
	})
	pendingPassiveEffects.update = []
	flushSyncCallbacks()
	return didFlushPassiveEffect
}

function workLoopSync() {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress)
	}
}

function workLoopConcurrent() {
	while (workInProgress !== null && !unstable_shouldYield()) {
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

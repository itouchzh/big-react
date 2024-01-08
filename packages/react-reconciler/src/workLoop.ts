import { scheduleMicroTask } from 'hostConfig'
import { beginWork } from './beginWork'
import {
	commitHookEffetListCreate,
	commitHookEffetListDestroy,
	commitHookEffetListUnmount,
	commitLayoutEffects,
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

//  重置 FiberRoot上的全局属性 和 `fiber树构造`循环过程中的全局变量
function prepareFreshStack(root: FiberRootNode, lane: Lane) {
	// 重置FiberRoot对象上的属性
	root.finishedLane = NoLane
	root.finishedWork = null
	// 重置全局变量
	workInProgress = createWorkInProgress(root.current, {})
	wipRootRenderLane = lane
}

// 连接container与renderRoot,在fiber中调度update
export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
	// 调度
	const root = markUpdateFromFiberToRoot(fiber)
	markRootUpdated(root, lane)
	// 对比更新
	ensureRootIsScheduled(root)
}
// 调度阶段入口
function ensureRootIsScheduled(root: FiberRootNode) {
	// 前半部分: 判断是否需要注册新的调度任务
	const updateLane = getHighestPriorityLane(root.pendingLanes)
	const existingCallback = root.callbackNode
	// 如果没有待处理的更新，取消已存在的回调
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

	// 优先级相同则返回
	if (curPriority === prevPriority) {
		return
	}
	// 中断上一个执行
	if (existingCallback !== null) {
		unstable_cancelCallback(existingCallback)
	}

	// 后半部分: 注册调度任务
	let newCallbackNode = null
	if (updateLane === SyncLane) {
		// 同步优先级，微任务调度
		if (__DEV__) {
			console.log('在微任务中调度，同步优先级', updateLane)
		}
		// 任务已经过期，需要同步执行render阶段
		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root))
		scheduleMicroTask(flushSyncCallbacks)
	} else {
		if (__DEV__) {
			console.log('在微任务中调度，优先级', updateLane)
		}
		// 其他优先级 用宏任务调度
		const schedulerPriority = lanesToSchedulePriority(updateLane)
		// 根据任务优先级异步执行render阶段,
		// newCallbackNode保存当前的回调节点，即使被中断也会被保存上，当恢复了以后，就可以从这里重新开始了
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

/**
 * @description 找到根节点
 * @param fiber
 * @returns
 */
function markUpdateFromFiberToRoot(fiber: FiberNode) {
	let node = fiber // 从给定的 Fiber 节点开始
	let parent = node.return

	// 通过遍历父节点，一直追溯到根节点
	while (parent !== null) {
		node = parent
		parent = node.return
	}

	// 如果最终追溯到的节点的类型是 HostRoot，则返回该节点的 stateNode（根节点实际的 DOM 节点）
	if (node.tag === HostRoot) {
		return node.stateNode
	}

	// 如果追溯到的节点不是 HostRoot，则返回 null，表示没有找到根节点
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
	// 构造fiber树
	const exitStatus = renderRoot(root, nextLane, false)

	if (exitStatus === RootCompleted) {
		// 3. 输出: 渲染fiber树
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
	// 1. 刷新pending状态的effects, 有可能某些effect会取消本次任务
	const didFlushPassiveEffect = flushPassiveEffects(root.pendingPassiveEffects)
	if (didFlushPassiveEffect) {
		if (root.callbackNode !== curCallback) {
			return null
		}
	}
	// 2. 获取本次渲染的优先级
	const lane = getHighestPriorityLane(root.pendingLanes)
	const curCallbackNode = root.callbackNode
	if (lane === NoLane) {
		return null
	}
	const needSync = lane === SyncLane || didTimeout
	// render阶段，  // 3. 构造fiber树
	const exitStatus = renderRoot(root, lane, !needSync)

	ensureRootIsScheduled(root)

	if (exitStatus === RootInComplete) {
		// 中断 如果当前执行的 scheduler task 已经发生了变化或者被取消了，返回 null
		if (root.callbackNode !== curCallbackNode) {
			return null
		}
		// 渲染被阻断, 返回一个新的performConcurrentWorkOnRoot函数, 等待下一次调用
		return performConcurrentWorkOnRoot.bind(null, root)
	}
	if (exitStatus === RootCompleted) {
		// 将最新的fiber树挂载到root.finishedWork节点上
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
		//dom 变更, 界面得到更新. 主要处理副作用队列中带有Placement, Update, Deletion, Hydrating标记的fiber节点.
		commitMutationEffects(finishedWork, root)
		root.current = finishedWork
		// layout
		// dom 变更后, 主要处理副作用队列中带有Update | Callback标记的fiber节点.
		commitLayoutEffects(finishedWork, root)
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
	// 循环遍历 current fiber tree 直到剩余执行时间不足
	while (workInProgress !== null && !unstable_shouldYield()) {
		performUnitOfWork(workInProgress)
	}
}

function performUnitOfWork(fiber: FiberNode) {
	// next 可能是子fiberNode，也可能是null，如果是子fiberNode，则继续递归,
	// next 是执行beginWork返回的下一个需要处理的Fiber节点
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

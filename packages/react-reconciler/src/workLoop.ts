import { beginWork } from './beginWork'
import { completeWork } from './completeWork'
import { FiberNode, FiberRootNode, createWorkInProgress } from './fiber'
import { HostRoot } from './workTag'

// 正在工作的fiberNode
let workInProgress: FiberNode | null = null

//  初始化
function prepareFreshStack(root: FiberRootNode) {
	workInProgress = createWorkInProgress(root.current, {})
}

// 连接container与renderRoot,在fiber中调度update
export function scheduleUpdateOnFiber(fiber: FiberNode) {
	// 调度
	const root = markUpdateFromFiberToRoot(fiber)
	renderRoot(root)
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

function renderRoot(root: FiberRootNode) {
	// 初始化
	prepareFreshStack(root)
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
	const finishedWork = root.current.alternate
	root.finishedWork = finishedWork

	// wip fiberNode 树中的flags
	commitRoot(root)
}

function workLoop() {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress)
	}
}

function performUnitOfWork(fiber: FiberNode) {
	// next 可能是子fiberNode，也可能是null，如果是子fiberNode，则继续递归
	const next = beginWork(fiber)
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

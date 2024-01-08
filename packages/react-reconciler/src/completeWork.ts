import {
	Container,
	appendInitialChild,
	createInstance,
	createTextInstance
} from 'hostConfig'
import { FiberNode } from './fiber'
import {
	Fragment,
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTag'
import { NoFlags, Ref, Update } from './fiberFlags'
// import { updateFiberProps } from 'react-dom/src/SyntheticEvent'

// 标记更新
function markUpdate(fiber: FiberNode) {
	fiber.flags |= Update
}

function markRef(fiber: FiberNode) {
	fiber.flags |= Ref
}

// 递归的归
export const completeWork = (wip: FiberNode) => {
	const newProps = wip.pendingProps
	const current = wip.alternate
	switch (wip.tag) {
		case HostComponent:
			// 构建一棵离屏dom树
			if (current !== null && wip.stateNode) {
				// update
				// props 是否变化
				// 变了 Update flag
				markUpdate(wip)
				// updateFiberProps(wip.stateNode, newProps)
				if (current.ref !== wip.ref) {
					markRef(wip)
				}
			} else {
				// mount
				// 1. 构建dom树
				const instance = createInstance(wip.type, newProps)
				// 2. 将dom插入dom树
				appendAllChildren(instance, wip)

				wip.stateNode = instance
				// 标记Ref
				if (wip.ref !== null) {
					markRef(wip)
				}
			}
			bubbleProperties(wip)
			break

		case HostText:
			if (current !== null && wip.stateNode) {
				// update
				const oldText = current.memoizedProps.content
				const newText = newProps.content
				if (oldText !== newText) {
					markUpdate(wip)
				}
			} else {
				const instance = createTextInstance(newProps.content)
				wip.stateNode = instance
			}
			bubbleProperties(wip)
			return null
		case HostRoot:
		case FunctionComponent:
		case Fragment:
			bubbleProperties(wip)
			return null
		default:
			if (__DEV__) {
				console.warn('未处理的completeWork情况', wip)
			}
			break
	}
}

function appendAllChildren(parent: Container, wip: FiberNode) {
	let node = wip.child
	// 递归查找，先向下，再向上
	while (node !== null) {
		if (node?.tag === HostComponent || node?.tag === HostText) {
			appendInitialChild(parent, node?.stateNode)
		} else if (node.child !== null) {
			node.child.return = node
			node = node.child
			continue
		}
		if (node === wip) {
			return
		}
		while (node.sibling === null) {
			if (node.return === null || node.return === wip) {
				return
			}
			node = node?.return
		}

		node.sibling.return = node.return
		node = node.sibling
	}
}

function bubbleProperties(wip: FiberNode) {
	let subtreeFlags = NoFlags
	let child = wip.child

	while (child !== null) {
		// 按位或
		subtreeFlags |= child.subtreeFlags
		subtreeFlags |= child.flags
		child.return = wip
		child = child.sibling
	}
	wip.subtreeFlags |= subtreeFlags
}

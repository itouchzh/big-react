import { Key, Props, ReactElementType, Ref } from 'shared/ReactType'
import { FunctionComponent, HostComponent, WorkTag } from './workTag'
import { Flags, NoFlags } from './fiberFlags'
import { Container } from 'hostConfig'
export class FiberNode {
	type: any
	tag: WorkTag
	key: Key
	stateNode: any
	return: FiberNode | null
	sibling: FiberNode | null
	child: FiberNode | null
	index: number
	ref: Ref

	pendingProps: Props
	memoizedProps: Props | null
	memoizedState: any
	alternate: FiberNode | null
	flags: Flags
	updateQueue: unknown
	// 代表子树中包含的flags
	subtreeFlags: Flags

	deletions: FiberNode[] | null

	constructor(tag: WorkTag, pendingProps: Props, key: Key) {
		this.tag = tag
		this.key = key
		// HostCompoennt
		this.stateNode = null
		// 类型就是div dom
		this.type = null

		// 构成树状结构
		// 指向父级
		this.return = null
		this.sibling = null
		this.child = null
		// 如果有好几个兄弟，那么这个是第几个
		this.index = 0
		this.ref = null

		// 构成工作单元
		this.pendingProps = pendingProps
		// 工作完成后的props
		this.memoizedProps = null
		this.memoizedState = null
		this.updateQueue = null

		// 切换当前的fiberNode与createElement
		this.alternate = null
		// 副作用
		this.flags = NoFlags
		this.subtreeFlags = NoFlags
		this.deletions = null
	}
}

// 创建根节点
export class FiberRootNode {
	// 保存rootElement
	container: Container
	current: FiberNode
	// 递归完成以后的hostRootFiber
	finishedWork: FiberNode | null

	constructor(container: Container, hostRootFiber: FiberNode) {
		this.container = container
		this.current = hostRootFiber
		hostRootFiber.stateNode = this
		this.finishedWork = null
	}
}

// 双缓存
export const createWorkInProgress = (
	current: FiberNode,
	pendingProps: Props
): FiberNode => {
	let wip = current.alternate
	// 首屏渲染
	if (wip === null) {
		// mount
		wip = new FiberNode(current.tag, pendingProps, current.key)
		wip.stateNode = current.stateNode
		wip.alternate = current
		current.alternate = wip
	} else {
		// update
		wip.pendingProps = pendingProps
		wip.flags = NoFlags
		wip.subtreeFlags = NoFlags
		wip.deletions = null
	}
	wip.type = current.type
	wip.updateQueue = current.updateQueue
	wip.child = current.child
	wip.memoizedProps = current.memoizedProps
	wip.memoizedState = current.memoizedState
	wip.ref = current.ref
	return wip
}

export function createFiberFromElement(element: ReactElementType) {
	const { type, key, props } = element
	let fiberTag: WorkTag = FunctionComponent

	if (typeof type === 'string') {
		// <div>
		fiberTag = HostComponent
	} else if (typeof type !== 'function' && __DEV__) {
		console.log('未定义type', element)
	}
	const fiber = new FiberNode(fiberTag, props, key)
	fiber.type = type
	return fiber
}

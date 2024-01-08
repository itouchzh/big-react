import { Key, Props, ReactElementType, Ref } from 'shared/ReactType'
import { Fragment, FunctionComponent, HostComponent, WorkTag } from './workTag'
import { Flags, NoFlags } from './fiberFlags'
import { Container } from 'hostConfig'
import { Lane, Lanes, NoLane, NoLanes } from './fiberLanes'
import { Effect } from './fiberHooks'
import { CallbackNode } from 'scheduler'
export class FiberNode {
	// 作为静态数据结构的属性
	// 对于 FunctionComponent，指函数本身，对于ClassComponent，指class，对于HostComponent，指DOM节点tagName
	type: any
	tag: WorkTag
	key: Key
	// 与fiber关联的局部状态节点(比如: HostComponent类型指向与fiber节点对应的 dom 节点;
	// 根节点fiber.stateNode指向的是FiberRoot;
	// class 类型节点其stateNode指向的是 class 实例).
	stateNode: any

	// 用于连接其他Fiber节点形成Fiber树
	return: FiberNode | null
	// 指向右边第一个兄弟Fiber节点
	sibling: FiberNode | null
	child: FiberNode | null
	index: number
	ref: Ref

	// 作为动态的工作单元的属性
	pendingProps: Props
	//上一次生成子节点时用到的属性, 生成子节点之后保持在内存中. 向下生成子节点之前叫做pendingProps,
	//生成子节点之后会把pendingProps赋值给memoizedProps用于下一次比较.
	//pendingProps和memoizedProps比较可以得出属性是否变动.
	memoizedProps: Props | null
	// 保存的是hooks的链表,指向fiber节点的内存状态. 在function类型的组件中, fiber.memoizedState就指向Hook队列
	memoizedState: any
	// 指向该fiber在另一次更新时对应的fiber， 双缓存机制
	// 每个被更新过 fiber 节点在内存中都是成对出现(current 和 workInProgress)
	alternate: FiberNode | null
	flags: Flags
	updateQueue: unknown
	// 代表子树中包含的flags
	subtreeFlags: Flags
	deletions: FiberNode[] | null

	constructor(tag: WorkTag, pendingProps: Props, key: Key) {
		this.tag = tag
		this.key = key || null
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
		this.ref = { current: null }

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

export interface PendingPassiveEffects {
	unmount: Effect[]
	update: Effect[]
}

// 创建根节点
export class FiberRootNode {
	// 保存rootElement
	container: Container
	current: FiberNode
	// 递归完成以后的hostRootFiber
	finishedWork: FiberNode | null

	pendingLanes: Lanes
	finishedLane: Lane

	pendingPassiveEffects: PendingPassiveEffects

	callbackNode: CallbackNode | null
	callbackPriority: Lane

	constructor(container: Container, hostRootFiber: FiberNode) {
		this.container = container
		this.current = hostRootFiber
		hostRootFiber.stateNode = this
		this.finishedWork = null
		this.pendingLanes = NoLanes
		this.finishedLane = NoLane
		this.pendingPassiveEffects = {
			unmount: [],
			update: []
		}
		this.callbackNode = null
		this.callbackPriority = NoLane
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
	const { type, key, props, ref } = element
	let fiberTag: WorkTag = FunctionComponent

	if (typeof type === 'string') {
		// <div>
		fiberTag = HostComponent
	} else if (typeof type !== 'function' && __DEV__) {
		console.log('未定义type', element)
	}
	const fiber = new FiberNode(fiberTag, props, key)
	fiber.type = type
	fiber.ref = ref
	return fiber
}

export function createFiberFromFragment(elements: any[], key: Key): FiberNode {
	const fiber = new FiberNode(Fragment, elements, key)
	return fiber
}

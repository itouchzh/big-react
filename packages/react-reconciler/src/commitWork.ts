import {
	Container,
	Instance,
	appendChildToContainer,
	commitUpdate,
	insertChildToContainer,
	removeChild
} from 'hostConfig'
import { FiberNode, FiberRootNode, PendingPassiveEffects } from './fiber'
import {
	ChildDeletion,
	Flags,
	LayoutMask,
	MutationMask,
	NoFlags,
	PassiveEffect,
	PassiveMask,
	Placement,
	Ref,
	Update
} from './fiberFlags'
import { FunctionComponent, HostComponent, HostRoot, HostText } from './workTag'
import { Effect, FCUpdateQueue } from './fiberHooks'
import { HookHasEffect } from './hookEffectTags'

let nextEffect: FiberNode | null = null

export function commitEffects(
	phrase: 'mutation' | 'layout',
	mask: Flags,
	callback: (fiber: FiberNode, root: FiberRootNode) => void
) {
	return (finishedWork: FiberNode, root: FiberRootNode) => {
		nextEffect = finishedWork
		while (nextEffect !== null) {
			// 向下遍历
			const child: FiberNode | null = nextEffect.child

			if ((nextEffect.subtreeFlags & mask) !== NoFlags && child !== null) {
				nextEffect = child
			} else {
				// 向上遍历 DFS
				up: while (nextEffect !== null) {
					callback(nextEffect, root)
					const sibling: FiberNode | null = nextEffect.sibling
					if (sibling !== null) {
						nextEffect = sibling
						break up
					}
					nextEffect = nextEffect.return
				}
			}
		}
	}
}

const commitMutationEffectsOnFiber = (
	finishedWork: FiberNode,
	root: FiberRootNode
) => {
	const { flags, tag } = finishedWork
	if ((flags & Placement) !== NoFlags) {
		commitPlacement(finishedWork)
		// 从flags中移除Placement
		finishedWork.flags &= ~Placement
	}

	// flags Update
	if ((flags & Update) !== NoFlags) {
		// 从flags中移除Update
		commitUpdate(finishedWork)
		finishedWork.flags &= ~Update
	}

	// // flags ChildDetection
	if ((flags & ChildDeletion) !== NoFlags) {
		// 从flags中移除ChildDetection
		const deletions = finishedWork.deletions

		if (deletions !== null) {
			deletions.forEach((childToDelete) => {
				commitDeletion(childToDelete, root)
			})
		}
		finishedWork.flags &= ~ChildDeletion
	}

	if ((flags & PassiveEffect) !== NoFlags) {
		// 收集回调
		commitPassiveEffect(finishedWork, root, 'update')
		finishedWork.flags &= ~PassiveEffect
	}
	if ((flags & Ref) !== NoFlags && tag === HostComponent) {
		safelyDetachRef(finishedWork)
	}
}
function safelyDetachRef(current: FiberNode) {
	const ref = current.ref
	if (ref !== null) {
		if (typeof ref === 'function') {
			ref(null)
		} else {
			ref.current = null
		}
	}
}

const commitLayoutEffectsOnFiber = (
	finishedWork: FiberNode,
	root: FiberRootNode
) => {
	const { flags, tag } = finishedWork

	if ((flags & Ref) !== NoFlags && tag === HostComponent) {
		// 绑定新的ref
		safelyAttachRef(finishedWork)
		finishedWork.flags &= ~Ref
	}
}
function safelyAttachRef(fiber: FiberNode) {
	const ref = fiber.ref
	if (ref !== null) {
		const instance = fiber.stateNode
		if (typeof ref === 'function') {
			ref(instance)
		} else {
			ref.current = instance
		}
	}
}

export const commitMutationEffects = commitEffects(
	'mutation',
	MutationMask | PassiveMask,
	commitMutationEffectsOnFiber
)

export const commitLayoutEffects = commitEffects(
	'layout',
	LayoutMask,
	commitLayoutEffectsOnFiber
)

function commitPassiveEffect(
	fiber: FiberNode,
	root: FiberRootNode,
	type: keyof PendingPassiveEffects
) {
	// update

	if (
		fiber.tag !== FunctionComponent ||
		(type === 'update' && (fiber.flags & PassiveEffect) === NoFlags)
	) {
		return
	}
	const updateQueue = fiber.updateQueue as FCUpdateQueue<any>

	if (updateQueue !== null) {
		if (updateQueue.lastEffect === null && __DEV__) {
			console.error('当FC存在PassiveEffect flag的时候， 不应该不存在Effect')
		}
		root.pendingPassiveEffects[type].push(updateQueue.lastEffect as Effect)
	}
}

function commitHookEffectList(
	flags: Flags,
	lastEffect: Effect,
	callback: (effect: Effect) => void
) {
	let effect = lastEffect.next as Effect
	do {
		if ((effect.tag & flags) === flags) {
			callback(effect)
		}
		effect = effect.next as Effect
	} while (effect !== lastEffect.next)
}

export function commitHookEffetListUnmount(flags: Flags, lastEffect: Effect) {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const destroy = effect.destroy

		if (typeof destroy === 'function') {
			destroy()
		}
		// 函数组件卸载了，那么useEffect里面的函数都不会触发了
		effect.tag &= ~HookHasEffect
	})
}

export function commitHookEffetListDestroy(flags: Flags, lastEffect: Effect) {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const destroy = effect.destroy
		if (typeof destroy === 'function') {
			destroy()
		}
	})
}

export function commitHookEffetListCreate(flags: Flags, lastEffect: Effect) {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const create = effect.create
		if (typeof create === 'function') {
			effect.destroy = create()
		}
	})
}

function recordHostChildrenToDelete(
	childrenToDelect: FiberNode[],
	unmountFiber: FiberNode
) {
	// 1. 找到第一个root host节点
	const lastOne = childrenToDelect[childrenToDelect.length - 1]
	if (!lastOne) {
		childrenToDelect.push(unmountFiber)
	} else {
		let node = lastOne.sibling
		while (node !== null) {
			if (unmountFiber === node) {
				childrenToDelect.push(unmountFiber)
			}
			node = node.sibling
		}
	}
	// 2. 每找到一个，判断是不是1 找到的节点的兄弟节点
}

function commitDeletion(childToDelete: FiberNode, root: FiberRootNode) {
	const rootChildrenToDelete: FiberNode[] = []
	// 递归子树
	commitNestedComponent(childToDelete, (unmountFiber) => {
		switch (unmountFiber.tag) {
			case HostComponent:
				recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber)
				safelyDetachRef(unmountFiber)
				return
			case HostText:
				recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber)
				return
			case FunctionComponent:
				// TODO useEffect unmount

				commitPassiveEffect(unmountFiber, root, 'unmount')
				return
			default:
				if (__DEV__) {
					console.warn('未处理unmount类型', unmountFiber)
				}
		}
	})
	// 移除rootHostNode dom
	if (rootChildrenToDelete.length) {
		const hostParent = getHostParent(childToDelete)
		if (hostParent !== null) {
			rootChildrenToDelete.forEach((node) => {
				removeChild(node.stateNode, hostParent)
			})
		}
	}

	childToDelete.return = null
	childToDelete.child = null
}

function commitNestedComponent(
	root: FiberNode,
	onCommitUnmount: (fiber: FiberNode) => void
) {
	let node = root
	while (true) {
		onCommitUnmount(node)
		if (node.child !== null) {
			node.child.return = node
			node = node.child
			continue
		}
		if (node === root) {
			return
		}

		while (node.sibling === null) {
			if (node.return === null || node.return === root) {
				return
			}

			node = node.return
		}
		node.sibling.return = node.return
		node = node.sibling
	}
}

const commitPlacement = (finishedWork: FiberNode) => {
	if (__DEV__) {
		console.warn('执行Placement操作')
	}
	// parent dom
	const hostParent = getHostParent(finishedWork)

	// host sibing
	const sibling = getHostSibling(finishedWork)
	// finishedWork ---> dom
	if (hostParent !== null) {
		insertOrAppendPlacementNodeIntoContainer(finishedWork, hostParent, sibling)
	}
}
/**
 * 难点在于目标fiber的hostSibling可能并不是他的同级sibling
 * 比如： <A/><B/> 其中：function B() {return <div/>} 所以A的hostSibling实际是B的child
 * 实际情况层级可能更深
 * 同时：一个fiber被标记Placement，那他就是不稳定的（他对应的DOM在本次commit阶段会移动），也不能作为hostSibling
 */
function getHostSibling(fiber: FiberNode) {
	let node: FiberNode = fiber
	findSibling: while (true) {
		while (node.sibling === null) {
			const parent = node.return
			if (
				parent === null ||
				parent.tag === HostComponent ||
				parent.tag === HostText
			) {
				return null
			}
			node = parent
		}
		node.sibling.return = node.return

		node = node.sibling

		while (node.tag !== HostText && node.tag !== HostComponent) {
			// 向下遍历
			if ((node.flags & Placement) !== NoFlags) {
				continue findSibling
			}

			if (node.child === null) {
				continue findSibling
			} else {
				node.child.return = node
				node = node.child
			}
		}

		if ((node.flags & Placement) === NoFlags) {
			return node.stateNode
		}
	}
}

function getHostParent(fiber: FiberNode) {
	let parent = fiber.return
	while (parent) {
		const parentTag = parent.tag
		// hostComponent HostRoot
		if (parentTag === HostComponent) {
			return parent.stateNode as Container
		}

		if (parentTag === HostRoot) {
			return (parent.stateNode as FiberRootNode).container
		}
		parent = parent.return
	}

	if (__DEV__) {
		console.warn('getHostParent 找不到host parent')
	}
	return null
}

function insertOrAppendPlacementNodeIntoContainer(
	finishedWork: FiberNode,
	hostParent: Container,
	before?: Instance
) {
	if (__DEV__) {
		console.warn('执行insertOrAppendPlacementNodeIntoContainer')
	}

	if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
		if (before) {
			insertChildToContainer(finishedWork.stateNode, hostParent, before)
		} else {
			appendChildToContainer(hostParent, finishedWork.stateNode)
		}

		return
	}

	const child = finishedWork.child
	if (child !== null) {
		insertOrAppendPlacementNodeIntoContainer(child, hostParent)
		let sibling = child.sibling
		while (sibling !== null) {
			insertOrAppendPlacementNodeIntoContainer(sibling, hostParent)
			sibling = sibling.sibling
		}
	}
}

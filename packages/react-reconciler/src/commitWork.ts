import { Container, appendChildToContainer } from 'hostConfig'
import { FiberNode, FiberRootNode } from './fiber'
import { MutationMask, NoFlags, Placement } from './fiberFlags'
import { HostComponent, HostRoot, HostText } from './workTag'

let nextEffect: FiberNode | null = null
export function commitMutationEffects(finishedWork: FiberNode) {
	nextEffect = finishedWork

	while (nextEffect !== null) {
		// 向下遍历
		const child: FiberNode | null = nextEffect.child

		if (
			(nextEffect.subtreeFlags & MutationMask) !== NoFlags &&
			child !== null
		) {
			nextEffect = child
		} else {
			// 向上遍历 DFS
			up: while (nextEffect !== null) {
				commitMutationEffectsOnFiber(nextEffect)

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

const commitMutationEffectsOnFiber = (finishedWork: FiberNode) => {
	const flags = finishedWork.flags
	if ((flags & Placement) !== NoFlags) {
		commitPlacement(finishedWork)
		// 从flags中移除Placement
		finishedWork.flags &= ~Placement
	}

	// flags Update
	// if ((flags & Update) !== NoFlags) {
	// 	// 从flags中移除Update
	// 	commitUpdate(finishedWork)
	// 	finishedWork.flags &= ~Update
	// }

	// // flags ChildDetection
	// if ((flags & ChildDetection) !== NoFlags) {
	// 	// 从flags中移除ChildDetection
	// 	commitChildDetection(finishedWork)
	// 	finishedWork.flags &= ~ChildDetection
	// }
}

const commitPlacement = (finishedWork: FiberNode) => {
	if (__DEV__) {
		console.warn('执行Placement操作')
	}
	// parent dom
	const hostParent = getHostParent(finishedWork)
	// finishedWork ---> dom
	if (hostParent !== null) {
		appendPlacementNodeIntoContainer(finishedWork, hostParent)
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

function appendPlacementNodeIntoContainer(
	finishedWork: FiberNode,
	hostParent: Container
) {
	if (__DEV__) {
		console.warn('appendPlacementNodeIntoContainer')
	}

	if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
		// appendChildToContainer(finishedWork.stateNode, hostParent)
		appendChildToContainer(hostParent, finishedWork.stateNode)
		return
	}

	const child = finishedWork.child
	if (child !== null) {
		appendPlacementNodeIntoContainer(child, hostParent)
		let sibling = child.sibling
		while (sibling !== null) {
			appendPlacementNodeIntoContainer(sibling, hostParent)
			sibling = sibling.sibling
		}
	}
}
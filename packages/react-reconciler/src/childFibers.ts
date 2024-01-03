import { Props, ReactElementType } from 'shared/ReactType'
import {
	FiberNode,
	createFiberFromElement,
	createWorkInProgress
} from './fiber'
import { HostText } from './workTag'
import { ChildDeletion, Placement } from './fiberFlags'
import { REACT_ELEMENT_TYPE } from '../../shared/ReactSymbols'

type ExistingChildren = Map<string | number, FiberNode>
/**
 *
 * @param shouldTrackEffects 是否追踪副作用，mounted不追踪，update追踪
 * @returns
 */
export function ChildReconciler(shouldTrackEffects: boolean) {
	function deleteChild(returnFiber: FiberNode, childToDelete: FiberNode) {
		if (!shouldTrackEffects) {
			return
		}

		const deletions = returnFiber.deletions
		if (deletions === null) {
			returnFiber.deletions = [childToDelete]
			returnFiber.flags |= ChildDeletion
		} else {
			deletions?.push(childToDelete)
		}
	}

	function deleteRemainingChildren(
		returnFiber: FiberNode,
		currentFirstChild: FiberNode | null
	) {
		if (!shouldTrackEffects) {
			return
		}

		let childToDelete = currentFirstChild
		while (childToDelete !== null) {
			deleteChild(returnFiber, childToDelete)
			childToDelete = childToDelete.sibling
		}
	}

	function reconcileSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElementType
	) {
		const key = element.key
		while (currentFiber !== null) {
			if (currentFiber.key === key) {
				// key相同
				if (element.$$typeof === REACT_ELEMENT_TYPE) {
					if (currentFiber.type === element.type) {
						// type相同
						const existing = useFiber(currentFiber, element.props)
						existing.return = returnFiber
						// 当前节点可以复用，标记其他节点为删除
						deleteRemainingChildren(returnFiber, currentFiber.sibling)
						return existing
					}
					// key相同，type不同，删掉所有
					deleteRemainingChildren(returnFiber, currentFiber)
					break
				} else {
					if (__DEV__) {
						console.warn('还未实现的element类型', element)
					}
					break
				}
			} else {
				// 删掉旧的 key不同
				deleteChild(returnFiber, currentFiber)
				currentFiber = currentFiber.sibling
			}
		}

		// 不能复用，根据react element 创建fiber
		const fiber = createFiberFromElement(element)
		fiber.return = returnFiber
		return fiber
	}

	function reconcilerSingleTextNode(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content: string | number
	) {
		while (currentFiber !== null) {
			// update
			if (currentFiber.tag === HostText) {
				// 类型没变,可以复用
				const existing = useFiber(currentFiber, { content })
				existing.return = returnFiber
				deleteRemainingChildren(returnFiber, currentFiber.sibling)
				return existing
			}
			deleteChild(returnFiber, currentFiber)
			currentFiber = currentFiber.sibling
		}
		const fiber = new FiberNode(HostText, { content }, null)
		fiber.return = returnFiber
		return fiber
	}
	// 插入单一节点
	function placeSingleChild(fiber: FiberNode) {
		// 首屏渲染且要追踪副作用
		if (shouldTrackEffects && fiber.alternate === null) {
			fiber.flags |= Placement
		}
		return fiber
	}

	function reconcileChildArray(
		returnFiber: FiberNode,
		currentFirstChild: FiberNode | null,
		newChild: any[]
	) {
		// 最后一个可以复用的fiber的位置
		let lastPlacedIndex: number = 0
		let lastNewFiber: FiberNode | null = null
		let firstNewFiber: FiberNode | null = null
		// 将current保存在map中,current 为更新前

		const existingChildren: ExistingChildren = new Map()

		let current = currentFirstChild
		while (current !== null) {
			const keyToUse = current.key !== null ? current.key : current.index
			existingChildren.set(keyToUse, current)
			current = current.sibling
		}

		for (let i = 0; i < newChild.length; i++) {
			// 遍历newChild 寻找是否可以复用
			const after = newChild[i]

			const newFiber = updateFromMap(returnFiber, existingChildren, i, after)

			if (newFiber === null) {
				continue
			}

			// 打标记 标记是移动还是插入
			newFiber.index = i
			newFiber.return = returnFiber

			if (lastNewFiber === null) {
				lastNewFiber = newFiber
				firstNewFiber = newFiber
			} else {
				lastNewFiber.sibling = newFiber
				lastNewFiber = lastNewFiber.sibling
			}

			if (!shouldTrackEffects) {
				continue
			}

			const current = newFiber.alternate
			if (current !== null) {
				const oldIndex = current.index
				if (oldIndex < lastPlacedIndex) {
					// 移动
					newFiber.flags |= Placement
					continue
				} else {
					// 不移动
					lastPlacedIndex = oldIndex
				}
			} else {
				newFiber.flags |= Placement
			}
		}

		// 	删除剩余map中剩余的删除
		existingChildren.forEach((fiber) => deleteChild(returnFiber, fiber))
		return firstNewFiber
	}

	function updateFromMap(
		returnFiber: FiberNode,
		existingChildren: ExistingChildren,
		index: number,
		element: any
	): FiberNode | null {
		const keyToUse = element.key !== null ? element.key : index
		const before = existingChildren.get(keyToUse)

		if (typeof element === 'string' || typeof element === 'number') {
			// HostText
			if (before) {
				if (before.tag === HostText) {
					existingChildren.delete(keyToUse)
					return useFiber(before, { content: element + '' })
				}
			} else {
				return new FiberNode(HostText, { content: element + '' }, null)
			}
		}

		// ReactElement 类型
		if (typeof element === 'object' && element !== null) {
			switch (element.$$typeof) {
				case REACT_ELEMENT_TYPE:
					if (before) {
						if (before.type === element.type) {
							existingChildren.delete(keyToUse)
						}
						return useFiber(before, element.props)
					}
					return createFiberFromElement(element)
			}
		}

		// TODO数组
		if (Array.isArray(element) && __DEV__) {
			console.warn('为实现')
		}
		return null
	}

	return function reconcilerChildFibers(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild?: ReactElementType
	) {
		// 判断fiber类型
		if (typeof newChild === 'object' && newChild !== null) {
			switch (newChild.$$typeof) {
				case REACT_ELEMENT_TYPE:
					// 创建FiberNode
					return placeSingleChild(
						reconcileSingleElement(returnFiber, currentFiber, newChild)
					)

				default:
					if (__DEV__) {
						console.warn('未实现reconcile类型', newChild)
					}
			}
			// 多节点
			if (Array.isArray(newChild)) {
				return reconcileChildArray(returnFiber, currentFiber, newChild)
			}
		}

		// 多节点
		// HostText
		if (typeof newChild === 'string' || typeof newChild === 'number') {
			return placeSingleChild(
				reconcilerSingleTextNode(returnFiber, currentFiber, newChild)
			)
		}
		// 兜底
		if (currentFiber !== null) {
			deleteChild(returnFiber, currentFiber)
		}

		if (__DEV__) {
			console.warn('未实现reconcile类型', newChild)
		}
		return null
	}
}

function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
	const clone = createWorkInProgress(fiber, pendingProps)

	clone.index = 0
	clone.sibling = null
	return clone
}

export const reconcileChildFibers = ChildReconciler(true)
export const mountChildFibers = ChildReconciler(false)

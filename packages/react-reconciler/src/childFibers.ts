import { ReactElementType } from 'shared/ReactType'
import { FiberNode, creasteFiberFromElement } from './fiber'
import { HostText } from './workTag'
import { Placement } from './fiberFlags'
import { REACT_ELEMENT_TYPE } from '../../shared/ReactSymbols'

/**
 *
 * @param shouldTrackEffects 是否追踪副作用，mounted不追踪，update追踪
 * @returns
 */
export function ChildReconciler(shouldTrackEffects: boolean) {
	function reconcilerSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElementType
	) {
		// 根据react element 创建fiber
		const fiber = creasteFiberFromElement(element)
		fiber.return = returnFiber
		return fiber
	}

	function reconcilerSingleTextNode(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content: string | number
	) {
		const fiber = new FiberNode(HostText, { content }, null)
		fiber.return = returnFiber
		return fiber
	}
	// 插入单一节点
	function placeSingleChild(fiber: FiberNode) {
		// 首屏渲染且要追踪副作用
		if (shouldTrackEffects && fiber.alternate === null) {
			fiber.flags = Placement
		}
		return fiber
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
						reconcilerSingleElement(returnFiber, currentFiber, newChild)
					)

				default:
					if (__DEV__) {
						console.warn('未实现reconcile类型', newChild)
					}
			}
		}

		// 多节点
		// HostText
		if (typeof newChild === 'string' || typeof newChild === 'number') {
			return placeSingleChild(
				reconcilerSingleTextNode(returnFiber, currentFiber, newChild)
			)
		}

		if (__DEV__) {
			console.warn('未实现reconcile类型', newChild)
		}
		return null
	}
}

export const reconcileChildFibers = ChildReconciler(true)
export const mountChildFibers = ChildReconciler(false)

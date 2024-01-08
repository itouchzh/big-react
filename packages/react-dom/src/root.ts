// ReactDOM.createRoot().render()

import {
	createContainer,
	updateContainer
} from '../../react-reconciler/src/fiberReconciler'
import { initEvent } from './SyntheticEvent'
import { Container } from './hostConfig'
import { ReactElementType } from 'shared/ReactType'

export function createRoot(container: Container) {
	// 1. 创建fiberRoot
	const root = createContainer(container)

	return {
		render(element: ReactElementType) {
			initEvent(container, 'click')
			return updateContainer(element, root)
		}
	}
}

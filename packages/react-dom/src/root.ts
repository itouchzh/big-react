// ReactDOM.createRoot().render()

import {
	createContainer,
	updateContainer
} from 'react-reconciler/src/fiberReconciler'
import { Container } from './hostConfig'
import { ReactElementType } from 'shared/ReactType'

export function createRoot(container: Container) {
	const root = createContainer(container)

	return {
		render(element: ReactElementType) {
			updateContainer(element, root)
		}
	}
}

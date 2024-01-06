import currentBatchConfig from './src/currentBatchConfig'
import currentDispatcher, {
	Dispatcher,
	resolveDispatcher
} from './src/currentDispatcher'
// import { jsx, isValidElement as isValidElementFn } from './src/jsx'
import {
	createElement as createElementFn,
	isValidElement as isValidElementFn
} from './src/jsx'

export const useState: Dispatcher['useState'] = (inititalState) => {
	const dispatcher = resolveDispatcher()
	return dispatcher.useState(inititalState)
}

export const useEffect: Dispatcher['useEffect'] = (create, deps) => {
	const dispatcher = resolveDispatcher()
	return dispatcher.useEffect(create, deps)
}

export const useTransition: Dispatcher['useTransition'] = () => {
	const dispatcher = resolveDispatcher()
	return dispatcher.useTransition()
}

// 内部数据共享层
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
	currentDispatcher,
	currentBatchConfig
}

export const version = '0.0.0'
// 开发环境jsxdev, 生产环境jsx
export const createElement = createElementFn

export const isValidElement = isValidElementFn
// React
// export default {
// 	version: '0.0.0',
// 	createElement: jsxDEV
// }

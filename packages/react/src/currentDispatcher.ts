import { Action } from 'shared/ReactType'

export interface Dispatcher {
	useState: <T>(inititalState: () => T | T) => [T, Dispatch<T>]
	useEffect: (callback: () => void | void, deps: any[]) => void
	useTransition: () => [boolean, (callback: () => void) => void]
	useRef: <T>(inititalValue: T) => { current: T }
}
// Action可以为状态或者为改变状态的函数
export type Dispatch<State> = (action: Action<State>) => void

const currentDispatcher: { current: Dispatcher | null } = {
	current: null
}

export const resolveDispatcher = (): Dispatcher => {
	const dispatcher = currentDispatcher.current
	if (dispatcher === null) {
		throw new Error('hooks 智能在函数组件中执行')
	}
	return dispatcher
}

export default currentDispatcher

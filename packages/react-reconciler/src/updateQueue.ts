import { Action } from 'shared/ReactType'

// react 有两种更新方法，第一种是this.setState() 第二种是this.setState((prevState)=>newState)
export interface Update<State> {
	action: Action<State>
}

export interface UpdateQueue<State> {
	shared: {
		pending: Update<State> | null
	}
}
/**
 * @description 创建update， 接受一个action
 * @return 最新的action
 */
export const createUpdate = <State>(action: Action<State>) => {
	return {
		action
	}
}

export const createUpdateQueue = <State>(): UpdateQueue<State> => {
	return {
		shared: {
			pending: null
		}
	} as UpdateQueue<State>
}

// 进入更新队列
export const enqueueUpdate = <State>(
	updateQueue: UpdateQueue<State>,
	update: Update<State>
) => {
	updateQueue.shared.pending = update
}

// 消费update
export const processUpdateQueue = <State>(
	baseState: State,
	pendingUpdate: Update<State> | null
): {
	memoizedState: State
} => {
	const result: ReturnType<typeof processUpdateQueue<State>> = {
		memoizedState: baseState
	}
	if (pendingUpdate !== null) {
		// baseState 1 update 2 => memoizedState 2
		// baseState 1 update (x) => 3x => memoizedState 3

		const action = pendingUpdate.action
		if (action instanceof Function) {
			result.memoizedState = action(baseState)
		} else {
			result.memoizedState = action
		}
	}

	return result
}

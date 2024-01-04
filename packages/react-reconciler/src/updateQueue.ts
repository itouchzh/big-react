import { Dispatch } from 'react/src/currentDispatcher'
import { Action } from 'shared/ReactType'
import { Lane } from './fiberLanes'

// react 有两种更新方法，第一种是this.setState() 第二种是this.setState((prevState)=>newState)
export interface Update<State> {
	action: Action<State>
	lane: Lane
	next: Update<any> | null
}

export interface UpdateQueue<State> {
	shared: {
		pending: Update<State> | null
	}

	dispatch: Dispatch<State> | null
}
/**
 * @description 创建update， 接受一个action
 * @return 最新的action
 */
export const createUpdate = <State>(action: Action<State>, lane: Lane) => {
	return {
		action,
		lane,
		next: null
	}
}

export const createUpdateQueue = <State>(): UpdateQueue<State> => {
	return {
		shared: {
			pending: null
		},
		dispatch: null
	} as UpdateQueue<State>
}

// 进入更新队列
export const enqueueUpdate = <State>(
	updateQueue: UpdateQueue<State>,
	update: Update<State>
) => {
	const pending = updateQueue.shared.pending

	if (pending === null) {
		//  a -> a
		update.next = update
	} else {
		// pending a -> b -> a
		update.next = pending.next
		pending.next = update
	}
	updateQueue.shared.pending = update
}

// 消费update
export const processUpdateQueue = <State>(
	baseState: State,
	pendingUpdate: Update<State> | null,
	renderLane: Lane
): {
	memoizedState: State
} => {
	const result: ReturnType<typeof processUpdateQueue<State>> = {
		memoizedState: baseState
	}
	if (pendingUpdate !== null) {
		// 第一个update
		let first = pendingUpdate.next
		let pending = pendingUpdate.next as Update<any>

		do {
			const updateLane = pending.lane
			if (updateLane === renderLane) {
				// baseState 1 update 2 => memoizedState 2
				// baseState 1 update (x) => 3x => memoizedState 3

				const action = pending.action
				if (action instanceof Function) {
					baseState = action(baseState)
				} else {
					baseState = action
				}
			} else {
				if (__DEV__) {
					console.error('不应该进入')
				}
			}
			pending = pending.next as Update<any>
		} while (pending !== first)
	}
	result.memoizedState = baseState
	return result
}

import { Dispatch } from 'react/src/currentDispatcher'
import { Action } from 'shared/ReactType'
import { Lane, NoLane, isSubsetOfLanes } from './fiberLanes'

// react 有两种更新方法，第一种是this.setState() 第二种是this.setState((prevState)=>newState)
export interface Update<State> {
	action: Action<State>
	lane: Lane
	// 指向链表中的下一个, 由于UpdateQueue是一个环形链表, 最后一个update.next指向第一个update对象
	next: Update<any> | null
}

// 一个环形链表
export interface UpdateQueue<State> {
	// baseState: State,
	// firstBaseUpdate: Update<State> | null,
	// lastBaseUpdate: Update<State> | null,
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
	baseState: State
	baseQueue: Update<State> | null
} => {
	const result: ReturnType<typeof processUpdateQueue<State>> = {
		memoizedState: baseState,
		baseState,
		baseQueue: null
	}
	if (pendingUpdate !== null) {
		// 第一个update
		const first = pendingUpdate.next
		let pending = pendingUpdate.next as Update<any>

		let newBaseState = baseState
		let newBaseQueueFirst: Update<State> | null = null
		let newBaseQueueLast: Update<State> | null = null
		let newState = baseState

		do {
			const updateLane = pending.lane
			if (!isSubsetOfLanes(renderLane, updateLane)) {
				// 优先级不够 被跳过
				const clone = createUpdate(pending.action, pending.lane)
				// 是不是第一个被跳过的
				if (newBaseQueueFirst === null) {
					// first u0 last = u0
					newBaseQueueFirst = clone
					newBaseQueueLast = clone
					newBaseState = newState
				} else {
					// first u0 -> u1 -> u2
					// last u2
					;(newBaseQueueLast as Update<State>).next = clone
					newBaseQueueLast = clone
				}
			} else {
				// 优先级足够
				if (newBaseQueueLast !== null) {
					const clone = createUpdate(pending.action, NoLane)
					newBaseQueueLast.next = clone
					newBaseQueueLast = clone
				}
				const action = pending.action
				if (action instanceof Function) {
					newState = action(baseState)
				} else {
					newState = action
				}
			}

			pending = pending.next as Update<any>
		} while (pending !== first)

		if (newBaseQueueLast === null) {
			// 本次计算没有update被跳过
			newBaseState = newState
		} else {
			newBaseQueueLast.next = newBaseQueueFirst
		}
		result.memoizedState = newState
		result.baseState = newBaseState
		result.baseQueue = newBaseQueueLast
	}
	return result
}

// 调度阶段

const button = document.querySelector('button')
const root = document.querySelector('#root')
import {
	unstable_ImmediatePriority as ImmediatePriority,
	unstable_UserBlockingPriority as UserBlockingPriority,
	unstable_NormalPriority as NormalPriority,
	unstable_LowPriority as LowPriority,
	unstable_IdlePriority as IdlePriority,
	unstable_scheduleCallback as scheduleCallback,
	unstable_shouldYield as shouldYield,
	CallbackNode,
	unstable_getFirstCallbackNode as getFirstCallbackNode,
	unstable_cancelCallback as cancelCallback
} from 'scheduler'
import './style.css'

// 优先级类型
type Priority =
	| typeof IdlePriority
	| typeof LowPriority
	| typeof NormalPriority
	| typeof UserBlockingPriority
	| typeof ImmediatePriority

interface Work {
	// work数量
	count: number
	priority: Priority
}

const workList: Work[] = []

let prevPriority: Priority = IdlePriority
let curCallback: CallbackNode | null = null
;[LowPriority, NormalPriority, UserBlockingPriority, ImmediatePriority].forEach(
	(priority) => {
		const btn = document.createElement('button')
		root?.appendChild(btn)
		btn.innerText = [
			'',
			'ImmediatePriority',
			'UserBlockingPriority',
			'NormalPriority',
			'LowPriority'
		][priority]
		btn.onclick = () => {
			workList.unshift({
				count: 100,
				priority: priority as Priority
			})
			schedule()
		}
	}
)

/**
 * 需要考虑的情况：
1. 工作过程仅有一个work
如果仅有一个work,Scheduler有个优化路径：如果调度
的回调函数的返回值是函数，则会继续调度返回的函数。

2. 工作过程中产生相同优先级的work
如果优先级相同，则不需要开启新的调度。
3 工作过程中产生更高/低优先级的work
把握一个原则：我们每次选出的都是优先级最高的wok。
 */

function schedule() {
	const cbNode = getFirstCallbackNode()
    const curWork = workList.sort((w1, w2) => w1.priority - w2.priority)[0]
    
    // 没有工作了取消
	if (!curWork) {
		curCallback = null
		cbNode && cancelCallback(cbNode)
		return
	}
	// TODO 策略
	const { priority: curPriority } = curWork
	if (curPriority === prevPriority) {
		return
	}
	

	// 更高优先级, 取消之前的
	cbNode && cancelCallback(cbNode)
	// 调度任务
	curCallback = scheduleCallback(curPriority, perform.bind(null, curWork))
}

function perform(work: Work, didTimeout?: boolean) {
	/**
	 *   1.work.priority
	 *   2. 饥饿问题
	 *   3.时间切片
	 */
	// 需要同步执行
	const needSync = work.priority === ImmediatePriority || didTimeout
	// 需要同步执行或者时间切片没有用尽
	while ((needSync || !shouldYield()) && work.count) {
		work.count--
		insertSpan(work.priority + '')
	}
	// 中断执行或者执行完了
	prevPriority = work.priority
	if (!work.count) {
		const workIndex = workList.indexOf(work)
        workList.splice(workIndex, 1)
        prevPriority = IdlePriority
	}
	const prevCallback = curCallback
	schedule()
	const newCallback = curCallback

	// 如果只有一个work可以继续调度
	if (newCallback && prevCallback === newCallback) {
		return perform.bind(null, work)
	}
}

function insertSpan(content) {
	const span = document.createElement('span')
	span.innerText = content
	span.className = `pri-${content}`
	// doSomeBuzyWork(100);
	root?.appendChild(span)
}

function doSomeBuzyWork(len: number) {
	let result = 0
	while (len--) {
		result += len
	}
}

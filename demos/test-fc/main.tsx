// import React, { useState, useEffect } from 'react'
// import ReactDOM from 'react-dom/client'

// function App() {
// 	const [num, updateNum] = useState(20)
// 	useEffect(() => {
// 		console.log('App mount')
// 	}, [])

// 	useEffect(() => {
// 		console.log('num change create', num)
// 		return () => {
// 			console.log('num change destroy', num)
// 		}
// 	}, [num])

// 	return (
// 		<ul onClick={() => updateNum(50)}>
// 			{new Array(num).fill(0).map((_, i) => {
// 				return <Child key={i}>{i}</Child>
// 			})}
// 		</ul>
// 	)
// }

// function Child({ children }) {
// 	return <li>{children}</li>
// }

// ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
import { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom/client'

function App() {
	const [isDel, del] = useState(false)
	const divRef = useRef(null)

	console.warn('render divRef', divRef.current)

	useEffect(() => {
		console.warn('useEffect divRef', divRef.current)
	}, [])

	return (
		<div ref={divRef} onClick={() => del(true)}>
			{isDel ? null : <Child />}
		</div>
	)
}

function Child() {
	return <p ref={(dom) => console.warn('dom is:', dom)}>Child</p>
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
)

import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'

function App() {
	const [num, updateNum] = useState(20)
	useEffect(() => {
		console.log('App mount')
	}, [])

	useEffect(() => {
		console.log('num change create', num)
		return () => {
			console.log('num change destroy', num)
		}
	}, [num])

	return (
		<ul onClick={() => updateNum(50)}>
			{new Array(num).fill(0).map((_, i) => {
				return <Child key={i}>{i}</Child>
			})}
		</ul>
	)
}

function Child({ children }) {
	return <li>{children}</li>
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)

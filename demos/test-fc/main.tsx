import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'

function App() {
	const [count] = useState(0)
	return <div>{count}</div>
}

function Child() {
	return <span>big-react</span>
}
ReactDOM.createRoot(document.getElementById('root')!).render(<App />)

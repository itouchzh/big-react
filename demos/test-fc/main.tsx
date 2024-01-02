import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'

function App() {
	const [count, setCount] = useState(100)
	return <div onClick={() => setCount(count + 1)}>{count}</div>
}

function Child() {
	return <span>big-react</span>
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)

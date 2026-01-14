import { useState } from 'react'
import './App.css'
import AgentWidget from './AgentWidget'

function App() {
  const [openWidget, setOpenWidget] = useState(null) // 'admin' or 'gu' or null

  const handleAdminToggle = () => {
    if (openWidget === 'admin') {
      setOpenWidget(null)
    } else {
      setOpenWidget('admin')
    }
  }

  const handleGuToggle = () => {
    if (openWidget === 'gu') {
      setOpenWidget(null)
    } else {
      setOpenWidget('gu')
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>DigitalOcean Agent Dashboard</h1>
          <p className="header-subtitle">Compare both agent widgets side by side</p>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-content">
          <div className="info-card">
            <h2>Agent Comparison Dashboard</h2>
            <p>Click the floating buttons to open each agent widget:</p>
            <ul>
              <li><strong>Left side:</strong> DigitalOcean Agent Widget</li>
              <li><strong>Right (Above) side:</strong> Custom Agent Widgets (Admin)</li>
              <li><strong>Right (Below) side:</strong> Custom Agent Widgets (General User)</li>
            </ul>
          </div>
        </div>
      </main>

      {/* Kash Admin UAT Agent Widget - Above */}
      <AgentWidget
        endpoint="https://a6lr2spltzjiavg3jpvvykdh.agents.do-ai.run"
        accessKey="6Mef2sh53p0PVQp8-NZp4WNCFTwpQNsu"
        title="Kash Admin UAT"
        widgetClass="admin-widget"
        isOpen={openWidget === 'admin'}
        onToggle={handleAdminToggle}
      />

      {/* Kash GU UAT Agent Widget - Below */}
      <AgentWidget
        endpoint="https://cjwxqfo73qvnnhcdywjzd5lz.agents.do-ai.run"
        accessKey="TAlLBNDqPKEfVpknNkwr6ETZSdaQYufU"
        title="Paz - General User"
        widgetClass="gu-widget"
        isOpen={openWidget === 'gu'}
        onToggle={handleGuToggle}
      />
    </div>
  )
}

export default App

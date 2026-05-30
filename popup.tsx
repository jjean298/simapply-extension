function Popup() {
  return (
    <div style={{ padding: 10 }}>
      <h3>Simapply</h3>
      <button
        onClick={() => {
          chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT })
        }}
      >
        Open Panel
      </button>
    </div>
  )
}

export default Popup
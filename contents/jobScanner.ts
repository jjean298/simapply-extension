const getPageText = () => {
  return document.body.innerText.slice(0, 12000)
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SCAN_JOB_PAGE") {
    sendResponse({
      text: getPageText(),
      url: window.location.href,
      title: document.title
    })
  }
})
import React from "react";
import "./WebViewPanel.css"; // Import the specific CSS

const WebViewPanel: React.FC = () => {
  return (
    // Wrapper div for scoping CSS
    <div id="web-view-content" className="h-full flex flex-col">
      {/* Replicated Browser Chrome HTML */}
      <div id="browser" className="clear flex-shrink-0">
        {/* tabs */}
        <ul className="tabs">
          {/* Single placeholder tab */}
          <li className="active">
            <img
              src="http://ademilter.com/wp-content/themes/ademilter/img/logo.png"
              alt="Tab Favicon"
            />
            <span>Example Site - Web Preview</span>
            <a className="close" href="#">
              ×
            </a>
          </li>
        </ul>
        {/* add tab */}
        <a href="#" className="add"></a>
        {/* bar */}
        <div className="bar clear">
          <ul>
            <li>
              <a className="icon-arrow-left" href="#" title="Back">
                <svg viewBox="0 0 16 16">
                  <path d="M16,7H3.8l5.6-5.6L8,0L0,8l8,8l1.4-1.4L3.8,9H16V7z" />
                </svg>
              </a>
            </li>
            <li>
              <a className="icon-arrow-right" href="#" title="Forward">
                <svg viewBox="0 0 16 16">
                  <path d="M8,0L6.6,1.4L12.2,7H0v2h12.2l-5.6,5.6L8,16l8-8L8,0z" />
                </svg>
              </a>
            </li>
            <li>
              <a className="icon-refresh" href="#" title="Refresh">
                <svg viewBox="0 0 16 16">
                  <path d="M13.6,2.3C12.2,0.9,10.2,0,8,0C3.6,0,0,3.6,0,8s3.6,8,8,8c3.7,0,6.8-2.5,7.7-6h-2.1c-0.8,2.3-3,4-5.6,4c-3.3,0-6-2.7-6-6 s2.7-6,6-6c1.7,0,3.1,0.7,4.2,1.8L9,7h7V0L13.6,2.3z" />
                </svg>
              </a>
            </li>
            <li>
              <a className="icon-home" href="#">
                ⌂
              </a>
            </li>
          </ul>
          <input id="favorite" type="checkbox" className="none" />
          <label htmlFor="favorite" className="favorite icon-star-empty">
            ☆
          </label>{" "}
          {/* Placeholder icon */}
          <input
            placeholder="Search"
            defaultValue="http://example.com/"
            type="text"
          />{" "}
          {/* Changed default value */}
          <ul className="drop">
            <li>
              <input id="panel" type="checkbox" className="none" />
              <label htmlFor="panel" className="icon-reorder">
                ☰
              </label>{" "}
              {/* Placeholder icon */}
              {/* Dropdown content removed for brevity/focus on style */}
            </li>
          </ul>
        </div>
      </div>

      {/* Actual content iframe area */}
      <div className="page flex-1 min-h-0">
        {/* TODO: Replace this with the actual iframe for rendering user code */}
        <iframe
          title="WebView Preview"
          width="100%"
          height="100%"
          srcDoc="<html><body>Preview Area</body></html>"
          frameBorder="0"
          className="bg-white" // Added white background for visibility
          // IMPORTANT: Add sandbox attribute here when loading user code!
          // sandbox="allow-scripts"
        ></iframe>
      </div>
    </div>
  );
};

export default WebViewPanel;

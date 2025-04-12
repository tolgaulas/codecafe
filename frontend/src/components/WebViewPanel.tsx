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
              <a className="icon-arrow-left" href="#">
                {"<"}
              </a>
            </li>{" "}
            {/* Placeholder icons */}
            <li>
              <a className="icon-arrow-right" href="#">
                {">"}
              </a>
            </li>
            <li>
              <a className="icon-refresh" href="#">
                ⟳
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

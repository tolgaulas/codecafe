import React, { useMemo } from "react";
import "./WebViewPanel.css"; // Import the specific CSS
import { FaEarthAmericas } from "react-icons/fa6"; // CORRECTED Import path

// Define props interface
interface WebViewPanelProps {
  htmlContent?: string;
  cssContent?: string;
  jsContent?: string;
}

const WebViewPanel: React.FC<WebViewPanelProps> = ({
  htmlContent = "",
  cssContent = "",
  jsContent = "",
}) => {
  // Construct srcDoc using useMemo to avoid unnecessary recalculations
  const srcDoc = useMemo(() => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          /* Basic reset for preview */
          body { margin: 0; padding: 8px; font-family: sans-serif; }
          ${cssContent}
        </style>
      </head>
      <body>
        ${htmlContent}
        <script>
          /* Optional: Add error handling for preview script */
          try {
            ${jsContent}
          } catch (error) {
            console.error('Preview Script Error:', error);
            // Optionally display error in the preview itself
            const errorDiv = document.createElement('div');
            errorDiv.style.position = 'fixed';
            errorDiv.style.bottom = '0';
            errorDiv.style.left = '0';
            errorDiv.style.right = '0';
            errorDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
            errorDiv.style.color = 'white';
            errorDiv.style.padding = '5px';
            errorDiv.style.fontSize = '12px';
            errorDiv.style.zIndex = '9999';
            errorDiv.textContent = 'Preview Script Error: ' + error.message;
            document.body.appendChild(errorDiv);
          }
        </script>
      </body>
      </html>
    `;
  }, [htmlContent, cssContent, jsContent]); // Dependencies for useMemo

  return (
    // Wrapper div for scoping CSS
    <div id="web-view-content" className="h-full flex flex-col">
      {/* Browser Chrome UI (Optional - can be simplified if needed) */}
      <div id="browser" className="clear flex-shrink-0">
        {/* tabs */}
        <ul className="tabs">
          {/* Single placeholder tab */}
          <li className="active">
            {/* Absolutely positioned icon wrapper (mimics example CSS) */}
            <span
              style={{
                position: "absolute",
                left: "-6px",
                top: "6px",
                zIndex: 9, // Match example
                transform: "skewX(-25deg)", // Apply inverse skew directly
                // Add display:block or inline-block for size to apply correctly
                display: "inline-block",
              }}
            >
              <FaEarthAmericas
                size={14}
                // Remove positioning classes from icon itself
              />
            </span>
            {/* Text span with inverse skew and padding */}
            <span
              style={{
                transform: "skewX(-25deg)",
                display: "inline-block", // Ensure it takes space for padding
              }}
            >
              Preview
            </span>
            {/* Close button remains a direct child for positioning relative to the skewed li */}
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
          </ul>
          <input
            placeholder="Search"
            defaultValue="http://example.com/"
            type="text"
          />{" "}
          {/* Changed default value */}
          <ul className="drop">
            <li>
              <input id="panel" type="checkbox" className="none" />
              <label htmlFor="panel" className="icon-reorder" title="Menu">
                <svg viewBox="0 0 16 16">
                  <path d="M1 3h14v2H1zM1 7h14v2H1zM1 11h14v2H1z" />
                </svg>
              </label>
              {/* Dropdown content removed for brevity/focus on style */}
            </li>
          </ul>
        </div>
      </div>

      {/* Actual content iframe area */}
      <div className="page flex-1 min-h-0">
        <iframe
          title="WebView Preview"
          width="100%"
          height="100%"
          srcDoc={srcDoc}
          frameBorder="0"
          className="bg-white"
          sandbox="allow-scripts"
        ></iframe>
      </div>
    </div>
  );
};

export default WebViewPanel;

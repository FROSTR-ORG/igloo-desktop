# Static Igloo Frontend

This is a static HTML/CSS/JavaScript version of the Igloo UI that replicates the exact look and functionality of the original React-based Igloo application. This frontend is designed to be served by an igloo-server and provides the same user experience as the original app.

## Features

- **Complete UI Replication**: Matches the original Igloo design exactly
- **Responsive Design**: Works on desktop and mobile devices
- **Interactive Elements**: Tooltips, modals, tabs, and navigation
- **No Dependencies**: Pure HTML/CSS/JS with only Lucide icons via CDN
- **Server Ready**: Can be served by any static file server or igloo-server

## File Structure

```
static-igloo/
├── index.html          # Main HTML file
├── styles.css          # Complete CSS styling (replicates Tailwind)
├── script.js           # JavaScript functionality
├── assets/
│   └── frostr-logo-transparent.png  # Frostr logo (replace with actual)
└── README.md           # This file
```

## Setup

1. Copy the `frostr-logo-transparent.png` from the original project:
   ```bash
   cp ../src/assets/frostr-logo-transparent.png ./assets/
   ```

2. Serve the files using any static file server:
   ```bash
   # Using Python
   python3 -m http.server 8000
   
   # Using Node.js serve
   npx serve .
   
   # Using PHP
   php -S localhost:8000
   ```

3. Open your browser to `http://localhost:8000`

## Integration with igloo-server

To use this frontend with your igloo-server:

1. Copy all files to your server's static file directory
2. Configure your server to serve these files as the frontend
3. Update any API endpoints in `script.js` to point to your server endpoints

## Key Components Replicated

### UI Components
- **App Header**: Logo and title with gradient text
- **Content Cards**: Main content containers with proper spacing
- **Buttons**: Primary, ghost, and icon button variants
- **Tabs**: Signer and Recover tab interface
- **Tooltips**: Help tooltips with rich content
- **Modals**: For share loading and confirmations
- **Share List**: Interactive list of saved shares

### Styling Features
- **Color Scheme**: Blue/gray gradient theme matching original
- **Typography**: Inter font for body text, Orbitron for title
- **Animations**: Hover effects, transitions, and loading states
- **Responsive**: Mobile-friendly layout adjustments

### JavaScript Functionality
- **View Management**: Navigation between different app views
- **Tab Switching**: Signer/Recover tab functionality
- **Share Management**: Load, delete, and manage shares
- **Modal System**: Reusable modal dialogs
- **Tooltip System**: Interactive help tooltips
- **Keyboard Navigation**: Escape to close modals, Ctrl+1/2 for tabs

## Customization

### Adding Real Functionality

Replace the mock functions in `script.js` with real API calls:

```javascript
// Replace this mock function
function loadShare(shareId) {
    // Mock implementation
}

// With real API call
async function loadShare(shareId) {
    try {
        const response = await fetch(`/api/shares/${shareId}/load`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: getPassword() })
        });
        const data = await response.json();
        // Handle real response
    } catch (error) {
        console.error('Failed to load share:', error);
    }
}
```

### Styling Modifications

All styling is in `styles.css`. The CSS classes mirror the Tailwind classes from the original:

- `.btn-primary` = `bg-blue-600 hover:bg-blue-700 text-blue-100`
- `.content-card` = `bg-gray-900/40 rounded-lg p-6 shadow-lg`
- `.share-item` = `bg-gray-800/60 rounded-md p-4 border border-gray-700`

### Adding New Views

1. Add HTML structure to `index.html`:
```html
<div class="view" id="my-new-view" style="display: none;">
    <!-- Your content here -->
</div>
```

2. Add navigation function to `script.js`:
```javascript
function showMyNewView() {
    showView('my-new-view');
}
```

3. Add CSS styling to `styles.css` as needed.

## Browser Compatibility

- **Modern Browsers**: Chrome 60+, Firefox 55+, Safari 12+, Edge 79+
- **Features Used**: CSS Grid, Flexbox, CSS Variables, ES6+
- **Dependencies**: Only Lucide icons via CDN

## Differences from Original

This static version includes these simplifications:

1. **Mock Data**: Uses sample shares instead of real data
2. **No File System**: File operations show alerts instead
3. **No Encryption**: Password dialogs are non-functional
4. **No WebSockets**: Signer functionality is placeholder
5. **No Routing**: Uses JavaScript view switching instead

## Development

To extend this frontend:

1. **Add New Components**: Follow the existing patterns in HTML/CSS/JS
2. **Update Styling**: Modify `styles.css` using the established class naming
3. **Add Interactions**: Extend `script.js` with new functions
4. **Test Responsive**: Check mobile layouts at different screen sizes

## Production Deployment

For production use:

1. **Minify Files**: Compress CSS/JS for better performance
2. **Optimize Images**: Compress the logo and any other images
3. **Enable Gzip**: Configure server to compress files
4. **Add CSP Headers**: Set appropriate security headers
5. **HTTPS**: Ensure secure connection for production

## API Integration Points

Key areas where you'll need to integrate with your igloo-server:

- `loadShare()`: Share decryption and loading
- `deleteShare()`: Share deletion
- `openLocation()`: File system operations
- `simulateCreateKeyset()`: Keyset creation workflow
- Share list population: Load actual shares from server

This static frontend provides a perfect foundation for your igloo-server integration while maintaining the exact look and feel of the original Igloo application. 
# Igloo Build and Release Process

This document outlines the process for building and releasing Igloo for Windows, macOS, and Linux platforms through GitHub releases.

## Prerequisites

### General Requirements
- Node.js and npm installed
- Git installed
- GitHub account with repository access

### Platform-Specific Requirements

#### Windows
- Windows machine or VM
- Visual Studio Build Tools

#### macOS
- macOS machine
- Xcode Command Line Tools

#### Linux
- Linux machine or VM
- Required build dependencies:
  ```bash
  sudo apt-get install --no-install-recommends -y icnsutils graphicsmagick xz-utils
  ```

## Environment Setup

### GitHub Release Setup
1. Create a GitHub Personal Access Token with `repo` scope
2. Set up environment variable:
   ```bash
   export GH_TOKEN="your-github-token"
   ```

## Build Commands

### Development Build
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Production Builds

#### Build for All Platforms
```bash
npm run dist
```

#### Platform-Specific Builds
```bash
# Windows only
npm run dist:win

# macOS only
npm run dist:mac

# Linux only
npm run dist:linux
```

### Testing Builds
```bash
# Test the packaged app locally
npm run pack
```

## Release Process

### 1. Version Update
Before releasing, update the version in `package.json`:
```json
{
  "version": "x.y.z"
}
```

### 2. Create Release
```bash
npm run release
```

This command will:
1. Build the application
2. Create distributables for all platforms
3. Create a GitHub release
4. Upload the distributables to the release

## Output Files

The built files will be available in the `release` directory:

### Windows
- `Igloo Setup x.y.z.exe` - NSIS installer
- `Igloo x.y.z.exe` - Portable executable

### macOS
- `Igloo-x.y.z.dmg` - DMG installer
- `Igloo-x.y.z-mac.zip` - Zipped application

### Linux
- `igloo-x.y.z.AppImage` - Portable AppImage
- `igloo_x.y.z.deb` - Debian package

## Troubleshooting

### Common Issues

1. **Build Fails on Windows**
   - Ensure Visual Studio Build Tools are installed
   - Check Windows SDK installation

2. **macOS Build Issues**
   - Verify Xcode Command Line Tools installation
   - Check for missing dependencies

3. **Linux Build Dependencies**
   - Install required system packages
   - Check for missing libraries

4. **GitHub Release Fails**
   - Verify GitHub token permissions
   - Check repository access rights
   - Ensure version number is unique

### Getting Help
If you encounter issues during the build process:
1. Check the [GitHub Issues](https://github.com/your-github-username/igloo/issues)
2. Review electron-builder [documentation](https://www.electron.build/)
3. Create a new issue with detailed error logs

## Security Considerations

1. **GitHub Token Security**
   - Use secure methods to store your GitHub token
   - Consider using a secrets management service
   - Rotate tokens regularly
   - Never commit tokens to the repository

2. **Release Verification**
   - Verify SHA256 checksums of releases
   - Document verification process for users
   - Consider adding GPG signatures to releases

## Maintenance

### Regular Tasks
1. Update dependencies regularly
2. Test builds on all platforms
3. Update documentation as needed
4. Monitor GitHub release downloads and issues

### Version Management
- Follow semantic versioning (MAJOR.MINOR.PATCH)
- Document breaking changes
- Update changelog for each release

## Additional Resources

- [Electron Builder Documentation](https://www.electron.build/)
- [Electron Security Guidelines](https://www.electronjs.org/docs/latest/tutorial/security)
- [GitHub Releases Documentation](https://docs.github.com/en/repositories/releasing-projects-on-github) 
const path = require('path');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: './src/renderer.tsx',
  target: 'electron-renderer',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true
            }
          }
        ],
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
    ],
  },
  resolve: {
    plugins: [new TsconfigPathsPlugin()],
    extensions: ['.tsx', '.ts', '.js', '.jsx']
  },
  output: {
    filename: 'renderer.js',
    path: path.resolve(__dirname, 'dist'),
  },
};

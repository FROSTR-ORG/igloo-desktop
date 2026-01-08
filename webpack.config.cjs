const path = require('path');
const webpack = require('webpack');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  devtool: process.env.NODE_ENV === 'production' ? 'source-map' : 'cheap-module-source-map',
  entry: './src/renderer.tsx',
  target: 'web',
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
      }
    ],
  },
  resolve: {
    plugins: [new TsconfigPathsPlugin()],
    extensions: ['.tsx', '.ts', '.js', '.jsx'],
    mainFields: ['browser', 'module', 'main'],
    conditionNames: ['browser', 'import', 'default'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Map to the React export, not a file path with extension
      'react/jsx-runtime': require.resolve('react/jsx-runtime')
    },
    fallback: {
      crypto: false,
      stream: false,
      buffer: require.resolve('buffer/')
    }
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer']
    })
  ],
  output: {
    filename: 'renderer.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: './'
  },
};

var nodeExternals = require('webpack-node-externals')
module.exports = {
	target: 'node',
	entry: './src/server.ts',
	externals: [nodeExternals()],
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				use: ['babel-loader', 'ts-loader'],
				exclude: /node_modules/
			}
		]
	}
}



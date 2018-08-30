var nodeExternals = require('webpack-node-externals')
module.exports =[{
	target: 'node',
	entry: './src/server.ts',
	externals: [nodeExternals()],
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				exclude: /node_modules/
			}
		]
	}
}]



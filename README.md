# ns.ont.dungeon
nodejs RESTful server for dungeon, an ontology game.


## Prepare for consensus node

1. Create account

	If you already had wallet.dat, skip this step.

	Create a workspace and execute commands below,
	```
	mkdir _workspace
	cd _workspace
	..\bin\ontology-windows-amd64.exe account add
	```

	**DO BACKUP YOUR wallet.dat AND PASSWORD**

2. Serve a consensus node

	In _workspace execute command below,

	* Local (development)
	```
	..\bin\ontology-windows-amd64.exe --testmode --rest
	```

	* Polaris (BETA test online) 
	```
	..\bin\ontology-windows-amd64.exe --networkid 2 --enableconsensus --rest 
	```

	* MainNet (production)
	```
	..\bin\ontology-windows-amd64.exe --networkid 1 --enableconsensus --rest
	```

	*If you serve a Polaris or MainNet consensus node, you have to wait for data synchronized.

## Compile ns.ont.dungeon



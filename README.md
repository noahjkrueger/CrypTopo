# CrypTopo
Topology Mapper for Bitcoin Blockchain.
This projects allows for a user to create a graphical representation of Bitcoin transactions 
from a certain Bitcoin wallet.

## Requirements
NOWNodes is the platform that we use to access historical blockchain data. In order to be given 
access to the API services, we require an API key. One will be granted an API key upon creating
an account at [NOWNodes](https://nownodes.io/). Note that this key is good for 10,000 requests 
per day, however, local testing has not been able to exceed this limit.

## Usage
The application is deployed at [cryptopo.netlify.app](https://cryptopo.netlify.app/). Using 
your API key as well as a valid Bitcoin wallet address, you can visualize and analyze the flow 
of crpyto up to a depth of 5. Ensure that both the API key and Bitcoin wallet address are
valid.
After graph creation, one can now move around nodes (which are representative of wallets) by 
simply dragging the nodes. Clicking on nodes will bring up relevant information about the wallet
on the left hand side which includes balance, addresss, transactions, etc. 

## Graph Intepretation
From an initial glance at the graph, there are two things that stand out - the node sizes and 
colors. The larger node is the root node that represents the wallet used to complete the search.
The different colors of nodes are representative of the number of transactions (warmer colored 
nodes represent wallets with a higher number of transactions). 

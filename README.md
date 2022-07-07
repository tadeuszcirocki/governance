# Governance

Build a simple smart contract project in Hardhat (using Solidity  
0.8.13) that introduces governance through OpenZeppelin's  
Governor and ERC721Votes from 4.5.0 release (it can be  
anything -> for example: simple control over ERC20 in Treasury).  
Ensure to have unit tests written to showcase proposal creation  
and voting.  
  
Contracts:  
MyGovernor.sol - governance contract using OpenZeppelin's Governor  
MyNFT.sol - vote token using OpenZeppelin's ERC721Votes  
MyToken.sol - ERC20 that governor has power over  
  
Test results:  
Governance voting  
    ✔ Should mint tokens to address if proposal successful (175ms)  
    ✔ Execute should revert if voting period has not yet passed (156ms)  
    ✔ Execute should revert if quorum not reached (79ms)  
    ✔ Execute should revert if for votes <= against votes (103ms)  
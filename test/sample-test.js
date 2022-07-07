const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { ethers } = require("hardhat");

describe("Governance", function () {

  it("Should return the new greeting once it's changed", async function () {
    // ERC721 vote token deployment
    const MyNft = await ethers.getContractFactory("MyNFT");
    const myNft = await MyNft.deploy();
    await myNft.deployed();

    // governor with MyNFT votes deployment
    const MyGovernor = await ethers.getContractFactory("MyGovernor");
    const myGovernor = await MyGovernor.deploy(myNft.address);
    await myGovernor.deployed();

    // ERC20 mintable by governor deployment
    const MyToken = await ethers.getContractFactory("MyToken");
    const myToken = await MyToken.deploy(myGovernor.address);
    await myToken.deployed();

    // supply = 100, addr1 has 1, addr2 - 2, addr3 - 3; quorum = 5%
    const [deployer, addr1, addr2, addr3] = await ethers.getSigners();
    await mintNftsToAddress(deployer.address, 96);
    await mintNftsToAddress(addr1.address, 1);
    await mintNftsToAddress(addr2.address, 2);
    await mintNftsToAddress(addr3.address, 3);

    // each user will be its own delegate
    await myNft.connect(addr1).delegate(addr1.address);
    await myNft.connect(addr2).delegate(addr2.address);
    await myNft.connect(addr3).delegate(addr3.address);

    // making a proposal of minting 1000 MyTokens to address
    const receiverAddress = '0x29D7d1dd5B6f9C864d9db560D72a247c178aE86B';
    const amount = BigNumber.from(1000).mul(1e18.toString());  // MTK has 18 decimals
    const mintCalldata = myToken.interface.encodeFunctionData('mint', [receiverAddress, amount]);
    const description = 'Proposal 1: Mint 1000 MTK to address';
    const tx = await myGovernor.propose(
      [myToken.address],
      [0],
      [mintCalldata],
      description
    );
    const rc = await tx.wait();
    const event = rc.events.find(event => event.event === 'ProposalCreated');
    const proposalId = event.args.proposalId;
    //1 block has to pass (set in MyGovernor)
    await network.provider.send("hardhat_mine", ['0x1']);
    
    // voting; '0' - against, '1' - for, '2' - abstain (does not count for quorum)
    await myGovernor.connect(addr1).castVote(proposalId, 1);
    await myGovernor.connect(addr2).castVote(proposalId, 1);
    await myGovernor.connect(addr3).castVote(proposalId, 1);

    // 45818 blocks got mined = one week has passed on eth mainnet (period set in MyGovernor)
    const oneWeekInBlocks = 45818;
    const oneWeekInBlocksHex = '0x' + oneWeekInBlocks.toString(16)
    await network.provider.send("hardhat_mine", [oneWeekInBlocksHex]);

    // execution
    const descriptionHash = ethers.utils.id(description);
    await myGovernor.execute(
      [myToken.address],
      [0],
      [mintCalldata],
      descriptionHash
    );

    console.log(await myToken.balanceOf(receiverAddress));


    // helper functions

    async function mintNftsToAddress(address, amount) {
      for (i = 0; i < amount; i++) {
        await myNft.safeMint(address);
      }
    }


  });



});

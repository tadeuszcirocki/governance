const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { ethers } = require("hardhat");

// This project could use more tests. Ones below are enough to present proposal creation and voting as asked.
// There's one proposal creation in beforeEach, then few voting scenarios.
describe("Governance voting", function () {

  // ERC721 vote token
  let MyNft;
  let myNft;

  // governor with MyNFT votes
  let MyGovernor;
  let myGovernor;

  // ERC20 mintable by governor
  let MyToken;
  let myToken;

  let deployer, addr1, addr2, addr3;

  let proposalId;
  let receiverAddress;
  let description;
  let mintCalldata;
  let amount;

  beforeEach(async () => {
    MyNft = await ethers.getContractFactory("MyNFT");
    myNft = await MyNft.deploy();
    await myNft.deployed();

    MyGovernor = await ethers.getContractFactory("MyGovernor");
    myGovernor = await MyGovernor.deploy(myNft.address);
    await myGovernor.deployed();

    MyToken = await ethers.getContractFactory("MyToken");
    myToken = await MyToken.deploy(myGovernor.address);
    await myToken.deployed();

    // supply = 100, addr1 has 1, addr2 - 2, addr3 - 3; quorum = 5% (set in MyGovernor)
    [deployer, addr1, addr2, addr3] = await ethers.getSigners();
    await mintNftsToAddress(deployer.address, 94);
    await mintNftsToAddress(addr1.address, 1);
    await mintNftsToAddress(addr2.address, 2);
    await mintNftsToAddress(addr3.address, 3);

    // each user will be its own delegate
    await myNft.connect(addr1).delegate(addr1.address);
    await myNft.connect(addr2).delegate(addr2.address);
    await myNft.connect(addr3).delegate(addr3.address);

    // making a proposal of minting 1000 MyTokens to address
    receiverAddress = '0x29D7d1dd5B6f9C864d9db560D72a247c178aE86B';
    amount = BigNumber.from(1000).mul(1e18.toString());  // MTK has 18 decimals
    mintCalldata = myToken.interface.encodeFunctionData('mint', [receiverAddress, amount]);
    description = 'Proposal 1: Mint 1000 MTK to address';
    const tx = await myGovernor.propose(
      [myToken.address],
      [0],
      [mintCalldata],
      description
    );
    const rc = await tx.wait();
    const event = rc.events.find(event => event.event === 'ProposalCreated');
    proposalId = event.args.proposalId;
    //1 block has to pass (set in MyGovernor)
    await network.provider.send("hardhat_mine", ['0x1']);
  });

  it("Should mint tokens to address if proposal successful", async function () {
    // voting; '0' - against, '1' - for, '2' - abstain (does not count for quorum)
    // 6/100 for
    await myGovernor.connect(addr1).castVote(proposalId, 1);
    await myGovernor.connect(addr2).castVote(proposalId, 1);
    await myGovernor.connect(addr3).castVote(proposalId, 1);

    // 45818 blocks got mined = one week has passed on eth mainnet (period set in MyGovernor)
    const oneWeekInBlocks = 45818;
    const oneWeekInBlocksHex = '0x' + oneWeekInBlocks.toString(16)
    await network.provider.send("hardhat_mine", [oneWeekInBlocksHex]);

    // should have zero before execution
    expect(await myToken.balanceOf(receiverAddress)).equal(0);

    // execution
    const descriptionHash = ethers.utils.id(description);
    await myGovernor.execute(
      [myToken.address],
      [0],
      [mintCalldata],
      descriptionHash
    );

    expect(await myToken.balanceOf(receiverAddress)).equal(amount);
  });

  it("Execute should revert if voting period has not yet passed", async function () {
    // voting; '0' - against, '1' - for, '2' - abstain (does not count for quorum)
    // 6/100 for
    await myGovernor.connect(addr1).castVote(proposalId, 1);
    await myGovernor.connect(addr2).castVote(proposalId, 1);
    await myGovernor.connect(addr3).castVote(proposalId, 1);

    // 45818 blocks got mined = one week has passed on eth mainnet (period set in MyGovernor)
    const halfAWeekInBlocks = 45818 / 2;
    const halfAWeekInBlocksHex = '0x' + halfAWeekInBlocks.toString(16)
    await network.provider.send("hardhat_mine", [halfAWeekInBlocksHex]);

    // execution
    const descriptionHash = ethers.utils.id(description);
    await expect(
      myGovernor.execute(
        [myToken.address],
        [0],
        [mintCalldata],
        descriptionHash
      )
    ).to.be.revertedWith("Governor: proposal not successful");
});

it("Execute should revert if quorum not reached", async function () {
  // voting; '0' - against, '1' - for, '2' - abstain (does not count for quorum)
  // 3/100 for which is not enough to reach 5% quorum
  await myGovernor.connect(addr1).castVote(proposalId, 1);
  await myGovernor.connect(addr2).castVote(proposalId, 1);

  // 45818 blocks got mined = one week has passed on eth mainnet (period set in MyGovernor)
  const oneWeekInBlocks = 45818;
  const oneWeekInBlocksHex = '0x' + oneWeekInBlocks.toString(16)
  await network.provider.send("hardhat_mine", [oneWeekInBlocksHex]);

  // execution
  const descriptionHash = ethers.utils.id(description);
  await expect(
    myGovernor.execute(
      [myToken.address],
      [0],
      [mintCalldata],
      descriptionHash
    )
  ).to.be.revertedWith("Governor: proposal not successful");
});

it("Execute should revert if for votes <= against votes", async function () {
  // voting; '0' - against, '1' - for, '2' - abstain (does not count for quorum)
  // 3 for, 3 against
  await myGovernor.connect(addr1).castVote(proposalId, 1);
  await myGovernor.connect(addr2).castVote(proposalId, 1);
  await myGovernor.connect(addr3).castVote(proposalId, 0);

  // 45818 blocks got mined = one week has passed on eth mainnet (period set in MyGovernor)
  const oneWeekInBlocks = 45818;
  const oneWeekInBlocksHex = '0x' + oneWeekInBlocks.toString(16)
  await network.provider.send("hardhat_mine", [oneWeekInBlocksHex]);

  // execution
  const descriptionHash = ethers.utils.id(description);
  await expect(
    myGovernor.execute(
      [myToken.address],
      [0],
      [mintCalldata],
      descriptionHash
    )
  ).to.be.revertedWith("Governor: proposal not successful");
});


// helper functions

async function mintNftsToAddress(address, amount) {
  for (i = 0; i < amount; i++) {
    await myNft.safeMint(address);
  }
}

});

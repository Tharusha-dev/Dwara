const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");

  const DwaraRegistry = await hre.ethers.getContractFactory("DwaraRegistry");
  const dwaraRegistry = await DwaraRegistry.deploy();
  await dwaraRegistry.waitForDeployment();

  const address = await dwaraRegistry.getAddress();
  console.log("DwaraRegistry deployed to:", address);
  
  return address;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

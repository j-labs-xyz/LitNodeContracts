const { expect } = require("chai");
const {
  ipfsIdToIpfsIdHash,
  getBytes32FromMultihash,
  getBytesFromMultihash,
} = require("../utils.js");
const { smock } = require("@defi-wonderland/smock");

describe("PKPPermissions", function () {
  let deployer;
  let signers;
  let routerContract;
  let pkpContract;
  let stakingContract;
  let tokenContract;
  let pkpPermissions;

  before(async () => {
    const RouterContractFactory = await ethers.getContractFactory(
      "PubkeyRouter"
    );
    const PKPContractFactory = await ethers.getContractFactory("PKPNFT");
    // mock the staking contract so we can get it into the state we need
    const StakingContractFactory = await smock.mock("Staking");
    const TokenContractFactory = await ethers.getContractFactory("LITToken");
    const PKPPermissionsFactory = await ethers.getContractFactory(
      "PKPPermissions"
    );

    [deployer, ...signers] = await ethers.getSigners();

    pkpContract = await PKPContractFactory.deploy();
    routerContract = await RouterContractFactory.deploy(pkpContract.address);
    tokenContract = await TokenContractFactory.deploy();

    await pkpContract.setRouterAddress(routerContract.address);

    pkpPermissions = await PKPPermissionsFactory.deploy(
      pkpContract.address,
      routerContract.address
    );

    stakingContract = await StakingContractFactory.deploy(
      tokenContract.address
    );

    stakingContract.isActiveValidator.returns(true);
    stakingContract.validatorCountForConsensus.returns(0);
  });

  describe("register a PKP and set routing permissions", async () => {
    context("when the PKP grants permission to an ETH address", async () => {
      // 64 byte pubkey - the max size we support
      let fakePubkey =
        "0x046db7b0736408e7874b746f6d54aa6e4d04fd8902b520af69493f62757e77e0b5247355f925af2b382b64c71fcb3ff3ad26469ca65b4d2945d6e6379a4f285b93";
      let tester;
      let creator;
      let tokenId;

      before(async () => {
        [creator, tester, ...signers] = signers;

        routerContract = await routerContract.connect(deployer);

        // check that the routing data for this pubkey is empty
        const pubkeyHash = ethers.utils.keccak256(fakePubkey);
        const [pubkeyBefore, stakingContractAddressBefore, keyType] =
          await routerContract.getRoutingData(pubkeyHash);
        expect(pubkeyBefore).equal("0x");
        expect(stakingContractAddressBefore).equal(
          "0x0000000000000000000000000000000000000000"
        );
        expect(keyType).equal(0);

        const keyTypeInput = 2;

        await routerContract.voteForRoutingData(
          pubkeyHash,
          fakePubkey,
          stakingContract.address,
          keyTypeInput
        );

        // validate that it was set
        const [pubkeyAfter, stakingContractAddressAfter, keyTypeAfter] =
          await routerContract.getRoutingData(pubkeyHash);
        expect(pubkeyAfter).equal(fakePubkey);
        expect(stakingContractAddressAfter).equal(stakingContract.address);
        expect(keyTypeAfter).equal(keyTypeInput);

        tokenId = ethers.BigNumber.from(pubkeyHash);

        // mint the PKP to the tester account
        pkpContract = await pkpContract.connect(tester);
        // send eth with the txn
        const mintCost = await pkpContract.mintCost();
        const transaction = {
          value: mintCost,
        };
        await pkpContract.mintNext(2, transaction);
        const owner = await pkpContract.ownerOf(pubkeyHash);
        expect(owner).equal(tester.address);
      });

      it("grants permission to an eth address and then revokes it", async () => {
        const addressToPermit = "0x75EdCdfb5A678290A8654979703bdb75C683B3dD";

        pkpContract = await pkpContract.connect(tester);

        // validate that the address is not permitted
        let permitted = await pkpPermissions.isPermittedAddress(
          tokenId,
          addressToPermit
        );
        expect(permitted).equal(false);

        // permit it
        pkpPermissions = await pkpPermissions.connect(tester);
        await pkpPermissions.addPermittedAddress(tokenId, addressToPermit, []);
        permitted = await pkpPermissions.isPermittedAddress(
          tokenId,
          addressToPermit
        );
        expect(permitted).equal(true);

        // revoke
        await pkpPermissions.removePermittedAddress(tokenId, addressToPermit);
        permitted = await pkpPermissions.isPermittedAddress(
          tokenId,
          addressToPermit
        );
        expect(permitted).equal(false);
      });

      it("grants permission to an IPFS id and then revokes it", async () => {
        const ipfsIdToPermit = "QmPRjq7medLpjnFSZaiJ3xUudKteVFQDmaMZuhr644MQ4Z";
        // const ipfsIdHash = ipfsIdToIpfsIdHash(ipfsIdToPermit);
        const ipfsIdBytes = getBytesFromMultihash(ipfsIdToPermit);

        pkpContract = await pkpContract.connect(tester);

        // validate that the ipfs ID is not permitted
        let permitted = await pkpPermissions.isPermittedAction(
          tokenId,
          ipfsIdBytes
        );
        expect(permitted).equal(false);

        // attempt to permit it
        // pkpPermissions = await pkpPermissions.connect(tester);
        // expect(
        //   pkpPermissions.addPermittedAction(tokenId, ipfsIdBytes)
        // ).revertedWith(
        //   "Please register your Lit Action IPFS ID with the registerAction() function before permitting it to use a PKP"
        // );
        // permitted = await pkpPermissions.isPermittedAction(tokenId, ipfsIdBytes);
        // expect(permitted).equal(false);

        // register the lit action
        // let registered = await pkpPermissions.isActionRegistered(ipfsIdBytes);
        // expect(registered).equal(false);
        // const multihashStruct = getBytes32FromMultihash(ipfsIdToPermit);
        // await pkpPermissions.registerAction(
        //   multihashStruct.digest,
        //   multihashStruct.hashFunction,
        //   multihashStruct.size
        // );
        // registered = await pkpPermissions.isActionRegistered(ipfsIdBytes);
        // expect(registered).equal(true);

        // permit it
        pkpPermissions = await pkpPermissions.connect(tester);
        await pkpPermissions.addPermittedAction(tokenId, ipfsIdBytes, []);
        permitted = await pkpPermissions.isPermittedAction(
          tokenId,
          ipfsIdBytes
        );
        expect(permitted).equal(true);

        // revoke
        await pkpPermissions.removePermittedAction(tokenId, ipfsIdBytes);
        permitted = await pkpPermissions.isPermittedAction(
          tokenId,
          ipfsIdBytes
        );
        expect(permitted).equal(false);
      });

      it("grants permission to an IPFS id and then revokes it", async () => {
        const ipfsIdToPermit = "QmNc6gpdFBq1dF1imq5xhHQPmbWuL7ScGXChr2rjPgfkbZ";
        const ipfsIdHash = ipfsIdToIpfsIdHash(ipfsIdToPermit);

        pkpContract = await pkpContract.connect(tester);

        // validate that the ipfs ID is not permitted
        let permitted = await pkpPermissions.isPermittedAction(
          tokenId,
          ipfsIdHash
        );
        expect(permitted).equal(false);

        const ipfsIdBytes = getBytesFromMultihash(ipfsIdToPermit);
        await pkpPermissions.addPermittedAction(tokenId, ipfsIdBytes, []);

        permitted = await pkpPermissions.isPermittedAction(
          tokenId,
          ipfsIdBytes
        );
        expect(permitted).equal(true);

        // revoke
        await pkpPermissions.removePermittedAction(tokenId, ipfsIdBytes);
        permitted = await pkpPermissions.isPermittedAction(
          tokenId,
          ipfsIdBytes
        );
        expect(permitted).equal(false);

        await pkpPermissions.addPermittedAction(tokenId, ipfsIdBytes, []);

        permitted = await pkpPermissions.isPermittedAction(
          tokenId,
          ipfsIdBytes
        );
        expect(permitted).equal(true);
      });

      it("registers and grants permission to a generic AuthMethod", async () => {
        const authMethodType = 5;
        const userId = "0xdeadbeef1234";
        const userPubkey = "0x9876543210";

        pkpContract = await pkpContract.connect(tester);

        // validate that the auth method is not permitted
        let permitted = await pkpPermissions.isPermittedAuthMethod(
          tokenId,
          authMethodType,
          userId,
          userPubkey
        );
        expect(permitted).equal(false);

        // attempt to permit it
        pkpPermissions = await pkpPermissions.connect(tester);
        await pkpPermissions.addPermittedAuthMethod(
          tokenId,
          authMethodType,
          userId,
          userPubkey,
          []
        );

        // lookup the pubkey by the user id
        let pubkey = await pkpPermissions.getUserPubkeyForAuthMethod(
          authMethodType,
          userId
        );
        // console.log("pubkey stored in contract", pubkey);
        // console.log("userPubkey", userPubkey);
        expect(pubkey).equal(userPubkey);

        permitted = await pkpPermissions.isPermittedAuthMethod(
          tokenId,
          authMethodType,
          userId,
          userPubkey
        );
        expect(permitted).equal(true);

        // do a reverse lookup
        let pkpIds = await pkpPermissions.getTokenIdsForAuthMethod(
          authMethodType,
          userId,
          userPubkey
        );
        expect(pkpIds.length).equal(1);
        expect(pkpIds[0]).equal(tokenId);

        // try a check with the wrong pubkey
        permitted = await pkpPermissions.isPermittedAuthMethod(
          tokenId,
          authMethodType,
          userId,
          "0x55"
        );
        expect(permitted).equal(false);

        // revoke
        await pkpPermissions.removePermittedAuthMethod(
          tokenId,
          authMethodType,
          userId,
          userPubkey
        );
        permitted = await pkpPermissions.isPermittedAuthMethod(
          tokenId,
          authMethodType,
          userId,
          userPubkey
        );
        expect(permitted).equal(false);

        // confirm that the reverse lookup is now empty
        pkpIds = await pkpPermissions.getTokenIdsForAuthMethod(
          authMethodType,
          userId,
          userPubkey
        );
        expect(pkpIds.length).equal(0);
      });

      it("registers and grants permission to a generic AuthMethod with scopes", async () => {
        const authMethodType = 5;
        const userId = "0xdeadbeef1234";
        const userPubkey = "0x9876543210";
        const scopes = [10, 20];

        pkpContract = await pkpContract.connect(tester);

        // validate that the auth method is not permitted
        let permitted = await pkpPermissions.isPermittedAuthMethod(
          tokenId,
          authMethodType,
          userId,
          userPubkey
        );
        expect(permitted).equal(false);

        // make sure the scopes aren't set
        let storedScopes = await pkpPermissions.getPermittedAuthMethodScopes(
          tokenId,
          authMethodType,
          userId,
          userPubkey,
          256
        );
        expect(storedScopes.length).equal(256);

        for (let i = 0; i < storedScopes.length; i++) {
          expect(storedScopes[i]).equal(false);
        }

        // check the scopes one by one
        for (let i = 0; i < scopes.length; i++) {
          const scopePresent =
            await pkpPermissions.isPermittedAuthMethodScopePresent(
              tokenId,
              authMethodType,
              userId,
              userPubkey,
              scopes[i]
            );
          expect(scopePresent).equal(false);
        }

        // attempt to permit it
        pkpPermissions = await pkpPermissions.connect(tester);
        await pkpPermissions.addPermittedAuthMethod(
          tokenId,
          authMethodType,
          userId,
          userPubkey,
          scopes
        );

        // lookup the pubkey by the user id
        let pubkey = await pkpPermissions.getUserPubkeyForAuthMethod(
          authMethodType,
          userId
        );
        // console.log("pubkey stored in contract", pubkey);
        // console.log("userPubkey", userPubkey);
        expect(pubkey).equal(userPubkey);

        permitted = await pkpPermissions.isPermittedAuthMethod(
          tokenId,
          authMethodType,
          userId,
          userPubkey
        );
        expect(permitted).equal(true);

        // do a reverse lookup
        let pkpIds = await pkpPermissions.getTokenIdsForAuthMethod(
          authMethodType,
          userId,
          userPubkey
        );
        expect(pkpIds.length).equal(1);
        expect(pkpIds[0]).equal(tokenId);

        // check the scopes
        storedScopes = await pkpPermissions.getPermittedAuthMethodScopes(
          tokenId,
          authMethodType,
          userId,
          userPubkey,
          256
        );
        expect(storedScopes.length).equal(256);
        for (let i = 0; i < scopes.length; i++) {
          expect(storedScopes[scopes[i]]).equal(true);
        }

        // check the scopes one by one
        for (let i = 0; i < scopes.length; i++) {
          const scopePresent =
            await pkpPermissions.isPermittedAuthMethodScopePresent(
              tokenId,
              authMethodType,
              userId,
              userPubkey,
              scopes[i]
            );
          expect(scopePresent).equal(true);
        }

        // remove a scope
        let scopePresent =
          await pkpPermissions.isPermittedAuthMethodScopePresent(
            tokenId,
            authMethodType,
            userId,
            userPubkey,
            scopes[0]
          );
        expect(scopePresent).equal(true);
        await pkpPermissions.removePermittedAuthMethodScope(
          tokenId,
          authMethodType,
          userId,
          userPubkey,
          scopes[0]
        );
        scopePresent = await pkpPermissions.isPermittedAuthMethodScopePresent(
          tokenId,
          authMethodType,
          userId,
          userPubkey,
          scopes[0]
        );
        expect(scopePresent).equal(false);

        // add a new scope
        const newScope = 40;
        scopePresent = await pkpPermissions.isPermittedAuthMethodScopePresent(
          tokenId,
          authMethodType,
          userId,
          userPubkey,
          newScope
        );
        expect(scopePresent).equal(false);
        await pkpPermissions.addPermittedAuthMethodScope(
          tokenId,
          authMethodType,
          userId,
          userPubkey,
          newScope
        );
        scopePresent = await pkpPermissions.isPermittedAuthMethodScopePresent(
          tokenId,
          authMethodType,
          userId,
          userPubkey,
          newScope
        );
        expect(scopePresent).equal(true);

        // try a check with the wrong pubkey
        permitted = await pkpPermissions.isPermittedAuthMethod(
          tokenId,
          authMethodType,
          userId,
          "0x55"
        );
        expect(permitted).equal(false);

        // revoke
        await pkpPermissions.removePermittedAuthMethod(
          tokenId,
          authMethodType,
          userId,
          userPubkey
        );
        permitted = await pkpPermissions.isPermittedAuthMethod(
          tokenId,
          authMethodType,
          userId,
          userPubkey
        );
        expect(permitted).equal(false);

        // confirm that the reverse lookup is now empty
        pkpIds = await pkpPermissions.getTokenIdsForAuthMethod(
          authMethodType,
          userId,
          userPubkey
        );
        expect(pkpIds.length).equal(0);
      });
    });
  });
});

//SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";

//@author Nethny
contract Distribution is Ownable {
    struct TeamMember {
        uint256 awardsAddress;
        address[] addresses;
        uint256 interest;
        uint256 shift; //Shift = 10**x interest = interest/shift
        bool choice; // 1- Receiving an award in tokens 0- Receiving an award in usd
        bool immutability;
    }

    address public Root;

    mapping(string => TeamMember) public teamTable;
    string[] public Team;

    function addNewTeamMember(
        string calldata Name,
        address _address,
        uint256 _interest,
        uint256 _shift,
        bool _immutability
    ) public onlyOwner {
        require(teamTable[Name].addresses.length == 0);

        teamTable[Name].addresses.push(_address);
        teamTable[Name].interest = _interest;
        teamTable[Name].shift = _shift;
        teamTable[Name].immutability = _immutability;

        Team.push(Name);
    }

    function changeTeamMember(
        string calldata Name,
        uint256 _interest,
        uint256 _shift,
        bool _immutability
    ) public onlyOwner {
        require(teamTable[Name].immutability == false);

        teamTable[Name].interest = _interest;
        teamTable[Name].shift = _shift;
        teamTable[Name].immutability = _immutability;
    }

    modifier onlyTeamMember(string calldata Name) {
        bool flag = false;
        for (uint256 i = 0; i < teamTable[Name].addresses.length; i++) {
            if (teamTable[Name].addresses[i] == msg.sender) {
                flag = true;
            }
        }

        require(flag);
        _;
    }

    function choose(string calldata Name, bool _choice)
        public
        onlyTeamMember(Name)
    {
        teamTable[Name].choice = _choice;
    }

    function addNewAddressTeam(string calldata Name, address _newAddress)
        public
        onlyTeamMember(Name)
    {
        teamTable[Name].addresses.push(_newAddress);
    }

    function chooseAddressTeam(string calldata Name, uint256 _choice)
        public
        onlyTeamMember(Name)
    {
        require(_choice < teamTable[Name].addresses.length);
        teamTable[Name].awardsAddress = _choice;
    }

    function getTeam() public view returns (string[] memory) {
        return Team;
    }

    function getTeamMember(string calldata name)
        public
        view
        returns (TeamMember memory)
    {
        return teamTable[name];
    }

    /// ====================================================== -Referal- ======================================================

    struct Member {
        address owner;
        uint256 interest;
        uint256 shift;
    }

    mapping(address => Member) public memberTable;

    function getMember(address member) public view returns (Member memory) {
        return memberTable[member];
    }

    function setOwner(address _owner) public {
        memberTable[msg.sender].owner = _owner;
    }

    function setOwners(address[] calldata members, address _owner)
        public
        onlyOwner
    {
        for (uint256 i = 0; i < members.length; i++) {
            memberTable[members[i]].owner = _owner;
        }
    }

    function changeMember(
        address member,
        address _owner,
        uint256 _interest,
        uint256 _shift
    ) public onlyOwner {
        memberTable[member].owner = _owner;
        memberTable[member].interest = _interest;
        memberTable[member].shift = _shift;
    }

    //Refferal owners part

    struct ReferralOwner {
        uint256 awardsAddress;
        address[] addresses;
    }

    mapping(address => ReferralOwner) public refferalOwnerTable;

    function getOwnerMember(address member)
        public
        view
        returns (ReferralOwner memory)
    {
        return refferalOwnerTable[member];
    }

    function addNewAddressReferral(address _newAddress) public {
        refferalOwnerTable[msg.sender].addresses.push(_newAddress);
    }

    function chooseAddressReferral(uint256 _choice) public {
        require(_choice < refferalOwnerTable[msg.sender].addresses.length);
        refferalOwnerTable[msg.sender].awardsAddress = _choice;
    }
}

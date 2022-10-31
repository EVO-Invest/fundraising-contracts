/*
//TODO
/// @notice Allows you to transfer data about pool members
/// This is necessary to perform token distribution in another network
/// @dev the arrays of participants and their investments must be the same size.
/// Make sure that the order of both arrays is correct,
/// if the order is wrong, the resulting investment table will not match reality
/// @param usersData - Participant array
/// @param usersAmount - The size of participants' investments
function importTable(
    address[] calldata usersData,
    uint256[] calldata usersAmount
) external onlyState(State.Pause) onlyOwner returns (bool) {
    require(
        usersData.length == usersAmount.length,
        "IMPORT: The number not match!"
    );

    for (uint256 i; i < usersData.length; i++) {
        _valueUSDList[usersData[i]] = usersAmount[i];
    }

    //Not all information is transferred to save gas
    //Implications: It is not possible to fully import data from here
    //To capture all the information you need to replenish this array with the right users
    //_listParticipants = usersData;

    return true;
}

//TODO
/// @notice Allows you to transfer data about pool members
/// This is necessary to perform token distribution in another network
/// @param fundsRaised - Number of funds raised
function importFR(uint256 fundsRaised)
    external
    onlyState(State.Pause)
    onlyOwner
    returns (bool)
{
    _FUNDS_RAISED = fundsRaised;
    return true;
}

//TODO
/// @notice Allows you to transfer data about pool members
/// This is necessary to perform token distribution in another network
/// @param collectedCommission - Number of commissions collected
function importCC(uint256 collectedCommission)
    external
    onlyState(State.Pause)
    onlyOwner
    returns (bool)
{
    _CURRENT_COMMISSION = collectedCommission;
    return true;
}

//TODO
/// @notice Allows you to transfer data about pool members
/// This is necessary to perform token distribution in another network
function closeImport()
    external
    onlyState(State.Pause)
    onlyOwner
    returns (bool)
{
    _state = State.WaitingToken;

    return true;
}
*/

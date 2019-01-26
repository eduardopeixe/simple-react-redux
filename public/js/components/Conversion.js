import React from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import debounce from 'lodash.debounce';

class FeesTable extends React.Component {
  render() {
    var {
      conversionRate,
      fee,
      total,
      originCurrency,
      destinationCurrency
    } = this.props;

    return (
      <div>
        <table>
          <tbody>
            <tr>
              <td>Conversion Rate</td>
              <td>
                1 {originCurrency} -> {conversionRate.toFixed(2)}{' '}
                {destinationCurrency}
              </td>
            </tr>
            <tr>
              <td>Fee</td>
              <td>
                {fee.toFixed(2)} {originCurrency}
              </td>
            </tr>
            <tr>
              <td className="total-label">Total Cost</td>
              <td>
                {total.toFixed(2)} {originCurrency}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
}

FeesTable.propTypes = {
  conversionRate: PropTypes.number.isRequired,
  originCurrency: PropTypes.string.isRequired,
  total: PropTypes.number.isRequired,
  destinationCurrency: PropTypes.string.isRequired
};

class Conversion extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      originAmount: '0.00',
      originCurrency: 'USD',
      destinationAmount: '0.00',
      destinationCurrency: 'EUR',
      feeAmount: 0.0,
      conversionRate: 1.5,
      totalCost: 0.0,
      errorMsg: ''
    };

    // bind event listeners so 'this' will be available in the handlers
    this.handleOriginAmountChange = this.handleOriginAmountChange.bind(this);
    this.handleDestAmountChange = this.handleDestAmountChange.bind(this);

    // origin will bind as a function - callback
    this.handleOriginCurrencyChange = this.handleCurrencyChange.bind(
      this,
      'origin'
    );
    this.handleDestCurrencyChange = this.handleCurrencyChange.bind(
      this,
      'destination'
    );
    this.handleAjaxFailure = this.handleAjaxFailure.bind(this);
  }

  componentDidMount() {
    // Add a debounced version of _getDestinationAmount() so we avoid server & UI Thrashing.
    // See http://stackoverflow.com/questions/23123138/perform-debounce-in-react-js/28046731#28046731
    this.makeConversionAjaxCall = debounce(this._makeConversionAjaxCall, 350);
    this.makeFeeAjaxCall = debounce(this._makeFeeAjaxCall, 350);

    this.originAmountInput.focus();
  }
  // we'll handle all failures the same
  handleAjaxFailure(resp) {
    var msg = 'Error. Please try again later.';

    if (resp && resp.request && resp.request.status === 0) {
      msg = 'Oh no! App appears to be offline.';
    }

    this.setState({
      errorMsg: msg
    });
  }
  // on success ensure no error message
  clearErrorMessage() {
    if (this.state.errorMsg) {
      this.setState({
        errorMsg: ''
      });
    }
  }
  handleCurrencyChange(currentlyEditing, event) {
    var obj = {};
    if (currentlyEditing === 'origin') {
      obj.originCurrency = event.target.value;
    } else {
      obj.destinationCurrency = event.target.value;
    }

    // just change both...
    // we have to use the callback so `this.state` will reflect the proper values
    // when they are called in _makeConversionAjaxCall()
    this.setState(obj, () => {
      // get new dest amount & conversion rates
      this.makeConversionAjaxCall({}, resp => {
        this.clearErrorMessage();

        this.setState({
          originAmount: resp.originAmount,
          // destinationAmount: resp.destAmount,
          destinationAmount: this.state.destinationAmount,
          conversionRate: resp.xRate
        });

        // get the new fee & total amount
        this.makeFeeAjaxCall(
          {
            originAmount: resp.originAmount,
            originCurrency: this.state.originCurrency,
            destCurrency: this.state.destinationCurrency
          },
          response => {
            this.setState({
              feeAmount: response.feeAmount
            });

            this.calcNewTotal();
          },
          this.handleAjaxFailure
        );
      });
    });
  }
  handleOriginAmountChange(event) {
    var newAmount = event.target.value;

    // remove unallowed chars
    newAmount = newAmount.replace(',', '');

    // optimistic field updates
    this.setState({ originAmount: newAmount });

    // get the new dest amount
    this.makeConversionAjaxCall(
      {
        currentlyEditing: 'origin',
        newValue: newAmount
      },
      resp => {
        this.clearErrorMessage();

        this.setState({
          conversionRate: resp.xRate,
          destinationAmount: resp.destAmount
        });
      },
      this.handleAjaxFailure
    );

    // get the new fee & total amount
    this.makeFeeAjaxCall(
      {
        originAmount: newAmount,
        originCurrency: this.state.originCurrency,
        destCurrency: this.state.destinationCurrency
      },
      resp => {
        this.setState({
          feeAmount: resp.feeAmount
        });

        this.calcNewTotal();
      }
    );
  }
  handleDestAmountChange(event) {
    var newAmount = event.target.value;

    // remove unallowed chars
    newAmount = newAmount.replace(',', '');
    // optimistic update
    this.setState({ destinationAmount: newAmount });

    this.makeConversionAjaxCall(
      {
        currentlyEditing: 'dest',
        newValue: newAmount
      },
      resp => {
        // make ajax call to get the fee amount..
        var newState = {
          conversionRate: resp.xRate,
          originAmount: resp.originAmount
        };

        this.setState(newState);

        // get the new fee & total amount
        this.makeFeeAjaxCall(
          {
            originAmount: resp.originAmount,
            originCurrency: this.state.originCurrency,
            destCurrency: this.state.destinationCurrency
          },
          resp => {
            this.setState({
              feeAmount: resp.feeAmount
            });

            this.calcNewTotal();
          },
          this.handleAjaxFailure
        );
      }
    );
  }
  // this is debounced in `componentDidMount()` as this.makeConversionAjaxCall()
  _makeConversionAjaxCall(data, successCallback, failureCallback) {
    var originCurrency = this.state.originCurrency;
    var destCurrency = this.state.destinationCurrency;

    var payload = {
      originAmount: data.newValue || this.state.originAmount,
      destAmount: data.newValue || this.state.destAmount,
      originCurrency: originCurrency,
      destCurrency: destCurrency,
      calcOriginAmount: false
    };

    // determine whether we need to calc origin or dest amount
    if (data.currentlyEditing === 'dest') {
      payload.calcOriginAmount = true;
    }

    // ajax call for destination amount
    // originCurrency, destCurrency, originAmount
    axios
      .get('/api/conversion', {
        params: payload
      })
      .then(resp => {
        successCallback(resp.data);
      })
      .catch(failureCallback);
  }
  // this is debounced in `componentDidMount()`
  _makeFeeAjaxCall(payload, successCallback, failureCallback) {
    axios
      .get('/api/fees', {
        params: payload
      })
      .then(resp => {
        successCallback(resp.data);
      })
      .catch(failureCallback);
  }
  calcNewTotal() {
    var newTotal =
      parseFloat(this.state.originAmount, 10) +
      parseFloat(this.state.feeAmount, 10);
    this.setState({ totalCost: parseFloat(newTotal) });
  }

  render() {
    if (this.state.errorMsg) {
      var errorMsg = <div className="errorMsg">{this.state.errorMsg}</div>;
    }

    return (
      <div>
        {errorMsg}
        <label>Convert</label>&nbsp;
        <input
          className="amount-field"
          ref={input => (this.originAmountInput = input)}
          onChange={this.handleOriginAmountChange}
          value={this.state.originAmount}
        />
        <select
          value={this.state.originCurrency}
          onChange={this.handleOriginCurrencyChange}
        >
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="JPY">JPY</option>
        </select>
        to{' '}
        <input
          className="amount-field"
          onChange={this.handleDestAmountChange}
          value={this.state.destinationAmount}
        />
        &nbsp;
        <select
          value={this.state.destinationCurrency}
          onChange={this.handleDestCurrencyChange}
        >
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="JPY">JPY</option>
        </select>
        <br />
        <br />
        <br />
        <FeesTable
          originCurrency={this.state.originCurrency}
          destinationCurrency={this.state.destinationCurrency}
          conversionRate={this.state.conversionRate}
          fee={this.state.feeAmount}
          total={this.state.totalCost}
        />
      </div>
    );
  }
}

export default Conversion;

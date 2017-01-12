/*The main scene of the app: a list of tasks*/
import React, {Component} from 'react'
import {View, StyleSheet, AsyncStorage, ScrollView, Vibration} from 'react-native'
import {Icon, List, ListItem} from 'react-native-elements'
import ScrollableTabView, {DefaultTabBar} from 'react-native-scrollable-tab-view'
import moment from 'moment'
import 'moment/locale/en-au'

import {colors, styles} from '../Styles'
import TitleBar from '../components/TitleBar'

const STORAGE_KEY = 'com.cadelwatson.android.tasks.state';
const DATETIME_DISPLAY_FORMAT = 'MMMM Do, YYYY, [at] h:mm a';
const NOW = moment();

// Get the days remaining until a Moment, in terms of real days
// (i.e. not just chunks of 24 hours. For example, any time tomorrow would return 1)
function daysRemaining(futureMoment) {
  const currentTimeInDays = NOW.year() * 365 + NOW.dayOfYear();
  const futureTimeInDays = futureMoment.year() * 365 + futureMoment.dayOfYear();

  return futureTimeInDays - currentTimeInDays;
}

function millisecondsRemaining(futureMoment) {
  return futureMoment.diff(NOW)
}

// Comparative function for tasks which sorts by days remaining until deadline
function compareTasks(a, b) {
  // Notes should always come before tasks
  if (a.note && b.note) {
    return 0;
  } else if (a.note) {
    return -1;
  } else if (b.note) {
    return 1;
  }

  const daysUntilA = millisecondsRemaining(a.deadline);
  const daysUntilB = millisecondsRemaining(b.deadline);

  if (daysUntilA === daysUntilB) {
    return 0;
  }

  return daysUntilA > daysUntilB ? 1 : -1;
}

// Return a color dependent on the urgency of the task, based on days remaining.
function priorityColor(daysRemaining) {
  if (daysRemaining <= 0) {
    return colors.priority1;
  } else if (daysRemaining === 1) {
    return colors.priority2;
  } else if (daysRemaining <= 7) {
    return colors.priority3
  } else {
    return colors.priority4;
  }
}

export default class MainScene extends Component {

  state = {tasks: [
    {
      title: 'New task',
      description: '',
      id: 1,
      completed: false,
      active: moment('2017-01-11 08:00'),
      deadline: moment('2017-02-12 08:00'),
    },
    {
      title: 'New note',
      description: '',
      id: 2,
      completed: false,
      active: moment('2020-01-01 08:00'),
      deadline: moment('2020-01-01 08:00'),
      note: true,
    }
  ]};

  componentWillMount() {
    this.flushStorage();
    this.load();
  }

  // Remove the stored state
  flushStorage = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
  };

  // Load the task list from AsyncStorage
  load = async () => {
    try {
      const loadedStateString = await AsyncStorage.getItem(STORAGE_KEY);

      // If there is no save data, exit early
      if (loadedStateString === null) {
        return;
      }

      // Parse the loaded string, converting timestamps to Moments
      const loadedTasks = JSON.parse(loadedStateString).tasks.map(x => {
        x.active = moment(x.active);
        x.deadline = moment(x.deadline);
        return x;
      });

      // Set the new state to the loaded tasks
      this.setState({tasks: loadedTasks})

    } catch (exception) {
      console.error("Couldn't load past state");
    }
  };

  // Save the current state in AsyncStorage
  save = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (exception) {
      console.error("Couldn't save current state")
    }
  };

  // Assign a task one of three statuses: 0 - upcoming, 1 - active, 2 - completed
  getTaskStatus = (task) => {
    if (task.completed) {
      return 2;
    } else if (moment().diff(task.active) >= 0 || task.note) {
      return 1;
    } else {
      return 0;
    }
  };

  // Open the EditScene to create a new task
  addTask = () => {
    let {tasks} = this.state;

    // The new ID is the highest current ID plus one. If there are currently no tasks, it defaults
    // to 1.
    var newID;
    if (tasks.length === 0) {
      newID = 1;
    } else {
      newID = Math.max(...tasks.map(x => x.id)) + 1;
    }

    // Create a blank task which will be 'edited': essentially the same as creating a new one!
    const blankTask = {
      title: 'New task',
      description: '',
      id: newID,
      completed: false,
      active: moment(),
      deadline: moment(),
    };

    this.props.navigator.push({
      id: 'Edit',
      task: blankTask,
      callback: this.appendNewTaskToState,
      sceneTitle: 'Add'
    })
  };

  // Append a task to the current tasks state
  appendNewTaskToState = (id, newTask) => {
    let {tasks} = this.state;
    tasks.push(newTask);
    console.log(tasks.map(x => x.id))
    this.setState({tasks});
    this.save();
  };

  // Replaces the task given by ID with the new task
  replaceTaskInState = (id, newTask) => {
    let {tasks} = this.state;
    // Find the task with the right ID
    const index = tasks.findIndex(x => x.id === id);
    // Replace with the new task
    tasks[index] = newTask;
    // Set the new state
    console.log(tasks.map(x => x.id))
    this.setState({tasks});
    this.save();
  };

  // Open the edit screen for the given task
  editTask = (id) => {
    const {tasks} = this.state;
    const task = tasks.find(x => x.id === id);

    this.props.navigator.push({
      id: 'Edit',
      task: task,
      callback: this.replaceTaskInState,
      sceneTitle: 'Edit'
    })
  };

  // If the given task is Active or Upcoming, move it to Completed. Otherwise, delete it
  completeTask = (id) => {
    let {tasks} = this.state;

    // Find the task with the right ID
    const index = tasks.findIndex(x => x.id === id);

    if (tasks[index].completed) {
      // Remove the task at the index
      tasks.splice(index, 1);
    } else {
      // Set its state to completed
      tasks[index].completed = true;
    }

    // Provide haptic feedback
    Vibration.vibrate([0, 100]);

    // Set the new state
    this.setState({tasks});
    this.save();
  };



  // Given a task object and list index, return a ListItem
  renderListItem(listItem, index) {
    if (listItem.hasOwnProperty('note') && listItem.note === true) {
      // Render notes
      return (
        <ListItem
          key={index}
          title={listItem.title}
          hideChevron={true}
          subtitle={'Note'}
          // The onPress function will call listItemPressed with the item's ID.
          onPress={() => this.editTask(listItem.id)}
          onLongPress={() => this.completeTask(listItem.id)}
        />
      )
    } else {
      // Render tasks
      return (
        <ListItem
          key={index}
          title={listItem.title}
          hideChevron={true}
          subtitle={listItem.deadline.format(DATETIME_DISPLAY_FORMAT)}
          badge={{value: daysRemaining(listItem.deadline),
                  badgeContainerStyle: {backgroundColor: priorityColor(daysRemaining(listItem.deadline))}}}

          // The onPress function will call listItemPressed with the item's ID.
          onPress={() => this.editTask(listItem.id)}
          onLongPress={() => this.completeTask(listItem.id)}
        />
      )
    }
  }

  render() {
    const {tasks} = this.state;
    return (
      <View style={styles.container}>

        <TitleBar title={'Tasks'} />

        <ScrollableTabView renderTabBar={() => <DefaultTabBar />}
                           prerenderingSiblingsNumber={Infinity}
                           tabBarActiveTextColor={colors.main}
                           tabBarUnderlineStyle={{backgroundColor: colors.main}}
        >

          <ScrollView tabLabel={'Active'}>
            <List containerStyle={styles.listContainerStyle}>
              {
                tasks.filter(x => this.getTaskStatus(x) === 1)
                  .sort(compareTasks)
                  .map((listItem, index) => this.renderListItem(listItem, index))
              }
            </List>
          </ScrollView>

          <ScrollView tabLabel={'Upcoming'}>
            <List containerStyle={styles.listContainerStyle}>
              {
                tasks.filter(x => this.getTaskStatus(x) === 0)
                  .sort(compareTasks)
                  .map((listItem, index) => this.renderListItem(listItem, index))
              }
            </List>
          </ScrollView>

          <ScrollView tabLabel={'Completed'}>
            <List containerStyle={styles.listContainerStyle}>
              {
                tasks.filter(x => this.getTaskStatus(x) === 2)
                  .map((listItem, index) => this.renderListItem(listItem, index))
              }
            </List>
          </ScrollView>
        </ScrollableTabView>

        <View style={styles.horizontal}>
          <Icon
            name={'note-add'}
            reverse
            color={colors.main}
            onPress={this.addTask}/>
        </View>

      </View>
    )
  }
}
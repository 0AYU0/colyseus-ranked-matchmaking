import { Room, Client, Delayed, matchMaker } from "colyseus";

interface PlayerLocation {
  longitude: number;
  latitude: number;
}

interface ClientStat {
  client: Client;
  options?: any;
  userType: string;
  name: string;
  location: PlayerLocation;
}

interface Patient extends ClientStat {
  availability: { start: Date; end: Date; };
  bestFit: Caregiver[];
}

interface Caregiver extends ClientStat {
  availability: { start: Date; end: Date; }[];
}

export class RankedLobbyRoom extends Room {
  /**
   * If `allowUnmatchedGroups` is true, players inside an unmatched group (that
   * did not reached `numClientsToMatch`, and `maxWaitingTime` has been
   * reached) will be matched together. Your room should fill the remaining
   * spots with "bots" on this case.
   */
  allowUnmatchedGroups: boolean = false

  /**
   * Evaluate groups for each client at interval
   */
  evaluateGroupsInterval = 2000;

  /**
  * name of the room to create
  */
  roomToCreate = "game";

  /**
   * after this time, create a match with a bot
   */
  maxWaitingTime = 15 * 1000;

  maxCaregiverThreshold = 5;

  /**
   * after this time, try to fit this client with a not-so-compatible group
   */
  maxWaitingTimeForPriority?: number = 10 * 1000;

  /**
   * number of players on each match
   */
  numClientsToMatch = 4;

  // /**
  //  * after a group is ready, clients have this amount of milliseconds to confirm
  //  * connection to the created room
  //  */
  // cancelConfirmationAfter = 5000;

  /**
   * rank and group cache per-player
   */
  patientStats: Patient[] = [];
  caregiverStats: Caregiver[] = [];

  onCreate(options: any) {
    if (options.maxWaitingTime) {
      this.maxWaitingTime = options.maxWaitingTime;  // set instance variables for the room
    }

    if (options.numClientsToMatch) {
      this.numClientsToMatch = options.numClientsToMatch;
    }

    this.onMessage("confirm", (client: Client, message: any) => {
      const stat = this.patientStats.find(stat => stat.client === client);
    })

    /**
     * Try to match clients into groups at each interval
     */
    this.setSimulationInterval(() => this.redistributeGroups(), this.evaluateGroupsInterval);
  }

  onJoin(client: Client, options: any) {
    if (options.userType === 'patient') {
      this.patientStats.push({
        client: client,
        userType: options.userType,
        name: options.name,
        location: { longitude: options.longitude, latitude: options.latitude },
        availability: { start: options.patientStartDateTime, end: options.patientEndDateTime },
        bestFit: [],
      });
    } else {
      console.log(options);
      this.caregiverStats.push({
        client: client,
        userType: options.userType,
        name: options.name,
        location: { longitude: options.longitude, latitude: options.latitude },
        availability: options.nextAvailableDays,
      });
    }
  }

  redistributeGroups() {
    this.patientStats.forEach((patient) => {
      this.caregiverStats.forEach((caregiver) => {
        const rank = this.genRankUsers(patient, caregiver);
        console.log(rank);
        if (rank > 10) {
          if (!patient.bestFit.some(elem => elem === caregiver)) {
            patient.bestFit.push(caregiver);
          }
        }
      })
    })
    this.checkGroupsReady();
  }

  genRankUsers(patient: Patient, caregiver: Caregiver) {
    const availabilityScore = this.calculateAvailability(patient, caregiver); //overlap of availability in minutes
    const distanceScore = this.calculateDistance(patient, caregiver); // distance between them in miles
    console.log(availabilityScore);
    console.log(distanceScore);
    return 100 * this.calculateAvailability(patient, caregiver) / this.calculateDistance(patient, caregiver);
  }

  calculateAvailability(patient: Patient, caregiver: Caregiver) {
    const currentDate = new Date();
    const patientAvailabilityStart = new Date(currentDate.toDateString() + " " + new Date(patient.availability.start).toLocaleTimeString())
      .setDate(new Date(currentDate).getDate() + ((7 - new Date(currentDate).getDay() + new Date(patient.availability.start).getDay()) % 7)); // takes weekday that patient is available, converts it to nearest day from current day
    const patientAvailabilityEnd = new Date(currentDate.toDateString() + " " + new Date(patient.availability.end).toLocaleTimeString())
      .setDate(new Date(currentDate).getDate() + ((7 - new Date(currentDate).getDay() + new Date(patient.availability.end).getDay()) % 7));
    const overlappingTimes = caregiver.availability.map(startEnd => {
      const start = startEnd.start;
      const end = startEnd.end;
      const overlap = Math.max(0, Math.min(new Date(end).getTime(), patientAvailabilityEnd) - Math.max(new Date(start).getTime(), patientAvailabilityStart)); // finds overlap in timing based on all caregiver availabilities
      return overlap / 60000;
    })
    return overlappingTimes.reduce((num1, num2) => num1 + num2, 0); // sums up overlapping times
  }

  calculateDistance(patient: Patient, caregiver: Caregiver) {
    const patientLongtiude = patient.location.longitude;
    const patientLatitude = patient.location.latitude;
    const caregiverLongtiude = caregiver.location.longitude;
    const caregiverLatitude = caregiver.location.latitude;

    const radiusMiles = 3963.1676;

    const radianPatientLatitude = patientLatitude * Math.PI / 180;
    const radianCaregiverLatitude = caregiverLatitude * Math.PI / 180;

    const angleLatitude = (patientLatitude - caregiverLatitude) * Math.PI / 180;
    const angleLongitude = (patientLongtiude - caregiverLongtiude) * Math.PI / 180;

    const a = Math.sin(angleLatitude / 2) * Math.sin(angleLatitude / 2) +
      Math.cos(radianCaregiverLatitude) * Math.cos(radianPatientLatitude) *
      Math.sin(angleLongitude) * Math.sin(angleLongitude);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return radiusMiles * c;
  }

  checkGroupsReady() {
    this.patientStats.forEach(user => {
      user.client.send("clients", user.bestFit.map(element => element.name).join(", "));
    });
  }

  onLeave(client: Client, consented: boolean) {
    const index = this.patientStats.findIndex(stat => stat.client === client);
    this.patientStats.splice(index, 1);
  }

  onDispose() {
  }

}
